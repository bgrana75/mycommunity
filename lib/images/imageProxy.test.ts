import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const dns = vi.hoisted(() => ({
    lookup: vi.fn(async (_hostname?: string, _options?: unknown) => [{ address: '1.1.1.1', family: 4 as const }]),
}));

vi.mock('node:dns/promises', () => ({
    lookup: (hostname: string, options?: unknown) => dns.lookup(hostname, options),
}));

import {
    assertSafeProxyUrl,
    fetchProxiedImage,
    hiveImageFallbackUrl,
    probeProxiedImage,
    ImageProxyError,
    isBlockedHostname,
    isBlockedIpAddress,
    isHivePlaceholderImage,
    MAX_IMAGE_BYTES,
    type ImageProxyDeps,
    type ProxyUpstream,
} from './imageProxy';

const JPEG = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

function upstream(partial: Partial<ProxyUpstream> & Pick<ProxyUpstream, 'status'>): ProxyUpstream {
    return {
        location: undefined,
        contentType: 'image/jpeg',
        contentLength: JPEG.length,
        body: JPEG,
        ...partial,
    };
}

function deps(overrides: Partial<ImageProxyDeps> = {}): ImageProxyDeps {
    return {
        resolve: vi.fn(async () => [{ address: '1.1.1.1', family: 4 as const }]),
        request: vi.fn(async () => upstream({ status: 200 })),
        ...overrides,
    };
}

describe('isBlockedIpAddress', () => {
    it('blocks loopback, private, link-local, metadata, and reserved ranges', () => {
        for (const ip of [
            '127.0.0.1',
            '10.1.2.3',
            '192.168.1.1',
            '172.16.0.1',
            '172.31.255.254',
            '169.254.169.254',
            '0.0.0.0',
            '100.64.0.1',
            '224.0.0.1',
            '255.255.255.255',
            '::1',
            'fe80::1',
            'fd00:ec2::254',
            '::ffff:7f00:1',
            '::ffff:127.0.0.1',
            '[::1]',
        ]) {
            expect(isBlockedIpAddress(ip), ip).toBe(true);
        }
    });

    it('allows ordinary public addresses', () => {
        expect(isBlockedIpAddress('8.8.8.8')).toBe(false);
        expect(isBlockedIpAddress('1.1.1.1')).toBe(false);
        expect(isBlockedIpAddress('172.32.0.1')).toBe(false);
        expect(isBlockedIpAddress('2606:4700:4700::1111')).toBe(false);
        expect(isBlockedIpAddress('::ffff:808:808')).toBe(false);
    });

    it('fails closed on values that are not IP addresses', () => {
        expect(isBlockedIpAddress('example.com')).toBe(true);
        expect(isBlockedIpAddress('not-an-ip')).toBe(true);
    });
});

describe('isBlockedHostname', () => {
    it('blocks localhost, mDNS, and cloud metadata names', () => {
        expect(isBlockedHostname('localhost')).toBe(true);
        expect(isBlockedHostname('localhost.')).toBe(true);
        expect(isBlockedHostname('nas.local')).toBe(true);
        expect(isBlockedHostname('metadata.google.internal')).toBe(true);
        expect(isBlockedHostname('foo.cluster.local')).toBe(true);
        expect(isBlockedHostname('host.docker.internal')).toBe(true);
        expect(isBlockedHostname('kubernetes.default.svc')).toBe(true);
    });

    it('does not block ordinary public hosts', () => {
        expect(isBlockedHostname('images.hive.blog')).toBe(false);
        expect(isBlockedHostname('example.com')).toBe(false);
    });
});

describe('assertSafeProxyUrl', () => {
    it('accepts a normal https image url', () => {
        const url = assertSafeProxyUrl('https://images.hive.blog/u/meno/avatar/sm');
        expect(url.hostname).toBe('images.hive.blog');
    });

    it('rejects non-http schemes, credentials, and proxy loops', () => {
        expect(() => assertSafeProxyUrl('file:///etc/passwd')).toThrow(ImageProxyError);
        expect(() => assertSafeProxyUrl('javascript:alert(1)')).toThrow(ImageProxyError);
        expect(() => assertSafeProxyUrl('https://user:pass@example.com/a.jpg')).toThrow(ImageProxyError);
        expect(() => assertSafeProxyUrl('https://example.com/api/image-proxy?url=https://example.com/a.jpg')).toThrow(ImageProxyError);
        expect(() => assertSafeProxyUrl('https://example.com/_next/image?url=%2Flogo.png')).toThrow(ImageProxyError);
        expect(() => assertSafeProxyUrl('https://example.com/foo/../../api/image-proxy')).toThrow(ImageProxyError);
    });

    it('rejects normalized private IP literals, including decimal and mapped forms', () => {
        for (const raw of [
            'http://127.0.0.1/a.jpg',
            'http://2130706433/a.jpg',
            'http://0x7f000001/a.jpg',
            'http://0177.0.0.1/a.jpg',
            'http://127.1/a.jpg',
            'http://169.254.169.254/latest/meta-data/',
            'http://[::1]/a.jpg',
            'http://[::ffff:127.0.0.1]/a.jpg',
            'http://10.0.0.5/a.jpg',
            'http://192.168.0.180/a.jpg',
            'http://0.0.0.0/a.jpg',
        ]) {
            expect(() => assertSafeProxyUrl(raw), raw).toThrow(ImageProxyError);
            try {
                assertSafeProxyUrl(raw);
            } catch (err) {
                expect((err as ImageProxyError).status, raw).toBe(403);
            }
        }
    });

    it('rejects internal hostnames before any fetch', () => {
        expect(() => assertSafeProxyUrl('http://localhost/a.jpg')).toThrow(ImageProxyError);
        expect(() => assertSafeProxyUrl('http://metadata.google.internal/computeMetadata/v1/')).toThrow(ImageProxyError);
        expect(() => assertSafeProxyUrl('http://nas.local/a.jpg')).toThrow(ImageProxyError);
    });

    it('rejects backslashes so they cannot be used as path tricks', () => {
        expect(() => assertSafeProxyUrl('http://example.com/foo\\bar')).toThrow(ImageProxyError);
    });
});

describe('fetchProxiedImage', () => {
    it('returns sniffed raster bytes from a public host', async () => {
        const fake = deps();
        const image = await fetchProxiedImage('https://example.com/pic.jpg', fake);
        expect(image.contentType).toBe('image/jpeg');
        expect(image.body.equals(JPEG)).toBe(true);
        expect(fake.resolve).toHaveBeenCalledWith('example.com', expect.any(AbortSignal));
        expect(fake.request).toHaveBeenCalledTimes(1);
    });

    it('does not resolve or request a private literal', async () => {
        const fake = deps();
        await expect(fetchProxiedImage('http://169.254.169.254/latest/meta-data/', fake)).rejects.toMatchObject({
            status: 403,
            code: 'blocked-ip',
        });
        expect(fake.resolve).not.toHaveBeenCalled();
        expect(fake.request).not.toHaveBeenCalled();
    });

    it('does not resolve an obvious internal hostname', async () => {
        const fake = deps();
        await expect(fetchProxiedImage('http://metadata.google.internal/x', fake)).rejects.toMatchObject({
            status: 403,
            code: 'blocked-host',
        });
        expect(fake.resolve).not.toHaveBeenCalled();
    });

    it('refuses a public name that resolves to a private or metadata address', async () => {
        const fake = deps({
            resolve: vi.fn(async () => [
                { address: '1.1.1.1', family: 4 as const },
                { address: '169.254.169.254', family: 4 as const },
            ]),
        });
        await expect(fetchProxiedImage('http://127.0.0.1.nip.io/a.jpg', fake)).rejects.toMatchObject({
            status: 403,
            code: 'blocked-resolved-ip',
        });
        expect(fake.request).not.toHaveBeenCalled();
    });

    it('re-checks each redirect and will not follow one onto a private host', async () => {
        const request = vi.fn(async () => upstream({
            status: 302,
            location: 'http://169.254.169.254/latest/meta-data/',
            body: Buffer.alloc(0),
            contentType: undefined,
            contentLength: 0,
        }));
        const fake = deps({ request });
        await expect(fetchProxiedImage('https://cdn.example/a.jpg', fake)).rejects.toMatchObject({
            status: 403,
        });
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('follows a redirect only onto another public host', async () => {
        const request = vi.fn()
            .mockResolvedValueOnce(upstream({
                status: 302,
                location: 'https://images.example/cdn/a.jpg',
                body: Buffer.alloc(0),
                contentLength: 0,
            }))
            .mockResolvedValueOnce(upstream({ status: 200 }));
        const fake = deps({ request });
        const image = await fetchProxiedImage('https://example.com/a.jpg', fake);
        expect(image.contentType).toBe('image/jpeg');
        expect(request).toHaveBeenCalledTimes(2);
        const secondTarget = request.mock.calls[1][0] as URL;
        expect(secondTarget.hostname).toBe('images.example');
    });

    it('stops after a small number of redirects instead of redirecting the client', async () => {
        const request = vi.fn(async () => upstream({
            status: 302,
            location: 'https://example.com/again.jpg',
            body: Buffer.alloc(0),
            contentLength: 0,
        }));
        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({ request }))).rejects.toMatchObject({
            status: 502,
            code: 'too-many-redirects',
        });
        expect(request.mock.calls.length).toBeLessThanOrEqual(4);
    });

    it('rejects non-images, svg, and oversized payloads', async () => {
        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({
            request: vi.fn(async () => upstream({
                status: 200,
                contentType: 'text/html',
                body: Buffer.from('<html><body>nope</body></html>'),
            })),
        }))).rejects.toMatchObject({ status: 415 });

        await expect(fetchProxiedImage('https://example.com/a.svg', deps({
            request: vi.fn(async () => upstream({
                status: 200,
                contentType: 'image/svg+xml',
                body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
            })),
        }))).rejects.toMatchObject({ status: 415 });

        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({
            request: vi.fn(async () => upstream({
                status: 200,
                contentLength: 11 * 1024 * 1024,
                body: Buffer.alloc(0),
            })),
        }))).rejects.toMatchObject({ status: 413 });
    });

    it('accepts a raster image served as octet-stream when the bytes match', async () => {
        const image = await fetchProxiedImage('https://example.com/a.jpg', deps({
            request: vi.fn(async () => upstream({
                status: 200,
                contentType: 'application/octet-stream',
            })),
        }));
        expect(image.contentType).toBe('image/jpeg');
    });

    it('rejects a sniffed image whose declared type is not a raster', async () => {
        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({
            request: vi.fn(async () => upstream({
                status: 200,
                contentType: 'image/svg+xml',
            })),
        }))).rejects.toMatchObject({ status: 415, code: 'content-type' });
    });

    it('does not turn an upstream error into a redirect or a successful body', async () => {
        await expect(fetchProxiedImage('https://example.com/missing.jpg', deps({
            request: vi.fn(async () => upstream({ status: 404, body: Buffer.from('missing'), contentType: 'text/plain' })),
        }))).rejects.toMatchObject({ status: 502, code: 'upstream-status' });
    });

    it('reports a missing Hivemoji as 404 without retrying through Hive', async () => {
        const request = vi.fn(async () => upstream({ status: 404, body: Buffer.from('{"message":"Not Found"}'), contentType: 'application/json' }));
        await expect(fetchProxiedImage('https://hivemoji.hivelytics.io/@speedtuning/@speedtuning', deps({
            request,
        }))).rejects.toMatchObject({ status: 404, code: 'hivemoji-missing' });
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('still treats a non-404 Hivemoji failure as a retryable upstream error', async () => {
        const request = vi.fn(async (target: URL) => {
            if (target.hostname === 'images.hive.blog') return upstream({ status: 200 });
            return upstream({ status: 500, body: Buffer.from('oops'), contentType: 'text/plain' });
        });
        const image = await fetchProxiedImage('https://hivemoji.hivelytics.io/@meno/@meno', deps({ request }));
        expect(image.fallback).toBe('hive');
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('rejects a body whose declared length is over the limit', async () => {
        const request = vi.fn(async () => upstream({
            status: 200,
            contentLength: 11 * 1024 * 1024,
            body: Buffer.alloc(0),
        }));
        await expect(fetchProxiedImage('https://example.com/huge.jpg', deps({ request }))).rejects.toMatchObject({
            status: 413,
        });
        expect(request).toHaveBeenCalledTimes(1);
    });

    it('retries a dead upstream through the Hive cache and marks the fallback', async () => {
        const original = 'https://cdn.discordapp.com/attachments/1/2/Meno_banner_Blue.png';
        const request = vi.fn(async (target: URL) => {
            if (target.hostname === 'images.hive.blog') return upstream({ status: 200 });
            return upstream({ status: 404, body: Buffer.from('missing'), contentType: 'text/plain' });
        });
        const image = await fetchProxiedImage(original, deps({ request }));
        expect(image.fallback).toBe('hive');
        expect(image.contentType).toBe('image/jpeg');
        expect(request).toHaveBeenCalledTimes(2);
        const fallbackTarget = request.mock.calls[1][0] as URL;
        expect(fallbackTarget.hostname).toBe('images.hive.blog');
        expect(fallbackTarget.pathname).toContain('/0x0/');
        expect(decodeURIComponent(fallbackTarget.pathname)).toContain(original);
    });

    it('retries a non-image response and a transport failure', async () => {
        const html = vi.fn(async (target: URL) => {
            if (target.hostname === 'images.hive.blog') return upstream({ status: 200 });
            return upstream({
                status: 200,
                contentType: 'text/html',
                body: Buffer.from('<html><body>gone</body></html>'),
            });
        });
        const fromHtml = await fetchProxiedImage('https://example.com/page', deps({ request: html }));
        expect(fromHtml.fallback).toBe('hive');

        const transport = vi.fn(async (target: URL) => {
            if (target.hostname === 'images.hive.blog') return upstream({ status: 200 });
            throw new ImageProxyError(502, 'upstream-error');
        });
        const fromTransport = await fetchProxiedImage('https://example.com/down.jpg', deps({ request: transport }));
        expect(fromTransport.fallback).toBe('hive');
        expect(transport).toHaveBeenCalledTimes(2);
    });

    it('does not ask Hive to fetch an images.hive.blog URL or a blocked host', async () => {
        const request = vi.fn(async () => upstream({
            status: 404,
            body: Buffer.from('missing'),
            contentType: 'text/plain',
        }));
        await expect(fetchProxiedImage('https://images.hive.blog/DQmmissing.jpg', deps({ request }))).rejects.toMatchObject({
            status: 502,
            code: 'upstream-status',
        });
        expect(request).toHaveBeenCalledTimes(1);
        expect(hiveImageFallbackUrl('https://images.hive.blog/0x0/https://cdn.discordapp.com/a.png')).toBeNull();

        const blocked = deps();
        await expect(fetchProxiedImage('http://169.254.169.254/latest/meta-data/', blocked)).rejects.toMatchObject({
            status: 403,
        });
        expect(blocked.request).not.toHaveBeenCalled();
        expect(blocked.resolve).not.toHaveBeenCalled();
    });

    it('treats Hive generic placeholder bytes as a failure', async () => {
        const hash = createHash('sha256').update(JPEG).digest('hex');
        expect(isHivePlaceholderImage(JPEG, new Set([hash]))).toBe(true);
        expect(isHivePlaceholderImage(JPEG, new Set())).toBe(false);

        const request = vi.fn(async (target: URL) => {
            if (target.hostname === 'images.hive.blog') return upstream({ status: 200 });
            return upstream({ status: 404, body: Buffer.from('missing'), contentType: 'text/plain' });
        });
        await expect(fetchProxiedImage('https://example.com/gone.jpg', deps({
            request,
            placeholderHashes: new Set([hash]),
        }))).rejects.toMatchObject({ status: 502, code: 'hive-placeholder' });
    });

    it('still fails when the Hive retry is not an image', async () => {
        const request = vi.fn(async (target: URL) => {
            if (target.hostname === 'images.hive.blog') {
                return upstream({ status: 403, body: Buffer.from('Forbidden'), contentType: 'text/plain' });
            }
            return upstream({ status: 404, body: Buffer.from('missing'), contentType: 'text/plain' });
        });
        await expect(fetchProxiedImage('https://example.com/gone.jpg', deps({ request }))).rejects.toMatchObject({
            status: 502,
            code: 'upstream-status',
        });
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('reuses a successful response from the caller cache and does not reuse a failure', async () => {
        const cache = new Map();
        const request = vi.fn(async () => upstream({ status: 200 }));
        const fake = deps({ request, cache });
        const url = 'https://example.com/cached.jpg';
        const first = await fetchProxiedImage(url, fake);
        const second = await fetchProxiedImage(url, fake);
        expect(second.body.equals(first.body)).toBe(true);
        expect(request).toHaveBeenCalledTimes(1);

        const entry = cache.get(new URL(url).href);
        expect(entry).toBeTruthy();
        entry.expires = Date.now() - 1;
        await fetchProxiedImage(url, fake);
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('does not cache an upstream miss', async () => {
        const cache = new Map();
        const request = vi.fn(async () => upstream({
            status: 404,
            body: Buffer.from('missing'),
            contentType: 'text/plain',
        }));
        // Already on images.hive.blog, so a miss is not retried through itself.
        const fake = deps({ request, cache });
        await expect(fetchProxiedImage('https://images.hive.blog/gone.jpg', fake)).rejects.toMatchObject({ status: 502 });
        await expect(fetchProxiedImage('https://images.hive.blog/gone.jpg', fake)).rejects.toMatchObject({ status: 502 });
        expect(request).toHaveBeenCalledTimes(2);
        expect(cache.size).toBe(0);
    });
});

describe('probeProxiedImage', () => {
    it('is true only when the upstream image is accepted', async () => {
        const ok = await probeProxiedImage('https://example.com/pic.jpg', deps());
        expect(ok).toBe(true);
    });

    it('is false for a 404 and for a private host, without fetching the private host', async () => {
        const missing = await probeProxiedImage('https://cdn.discordapp.com/attachments/1/2/banner.png', deps({
            request: vi.fn(async () => upstream({ status: 404, body: Buffer.from('nope'), contentType: 'text/plain' })),
        }));
        expect(missing).toBe(false);

        const fake = deps();
        const blocked = await probeProxiedImage('http://169.254.169.254/latest/meta-data/', fake);
        expect(blocked).toBe(false);
        expect(fake.resolve).not.toHaveBeenCalled();
        expect(fake.request).not.toHaveBeenCalled();
    });
});

const PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const GIF = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(6)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
const AVIF = Buffer.concat([Buffer.alloc(4), Buffer.from('ftyp'), Buffer.from('avif')]);

describe('image sniffing and address short-circuits', () => {
    it('sniffs png, gif, webp, and avif and accepts a declared charset', async () => {
        for (const [body, type, header] of [
            [PNG, 'image/png', 'image/png; charset=binary'],
            [GIF, 'image/gif', 'image/gif'],
            [WEBP, 'image/webp', 'IMAGE/WEBP'],
            [AVIF, 'image/avif', 'image/avif'],
        ] as const) {
            const image = await fetchProxiedImage(`https://example.com/${type}`, deps({
                request: vi.fn(async () => upstream({ status: 200, body, contentType: header, contentLength: body.length })),
            }));
            expect(image.contentType).toBe(type);
        }
    });

    it('connects to a public IP literal without a DNS lookup, including ipv6', async () => {
        const fake = deps();
        const v4 = await fetchProxiedImage('http://1.1.1.1/a.jpg', fake);
        expect(v4.contentType).toBe('image/jpeg');
        expect(fake.resolve).not.toHaveBeenCalled();
        const v6 = await fetchProxiedImage('http://[2606:4700:4700::1111]/a.jpg', deps());
        expect(v6.contentType).toBe('image/jpeg');
    });

    it('maps resolver failures and refuses an empty or private answer', async () => {
        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({
            resolve: vi.fn(async () => { throw new Error('ENOTFOUND'); }),
        }))).rejects.toMatchObject({ code: 'dns-failed' });

        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({
            resolve: vi.fn(async () => { throw new ImageProxyError(504, 'dns-timeout'); }),
        }))).rejects.toMatchObject({ code: 'dns-timeout' });

        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({
            resolve: vi.fn(async () => []),
        }))).rejects.toMatchObject({ code: 'dns-empty' });

        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({
            resolve: vi.fn(async () => [{ address: '', family: 4 as const }]),
        }))).rejects.toMatchObject({ code: 'blocked-resolved-ip' });
    });

    it('rejects a redirect with a bad location and a body over the size limit', async () => {
        await expect(fetchProxiedImage('https://example.com/a.jpg', deps({
            request: vi.fn(async () => upstream({ status: 302, location: 'http://[', body: Buffer.alloc(0), contentLength: 0 })),
        }))).rejects.toMatchObject({ code: 'invalid-url' });

        const big = Buffer.alloc(MAX_IMAGE_BYTES + 1);
        big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
        await expect(fetchProxiedImage('https://example.com/huge-body.jpg', deps({
            request: vi.fn(async () => upstream({
                status: 200,
                body: big,
                contentLength: null,
                contentType: 'image/jpeg',
            })),
        }))).rejects.toMatchObject({ status: 413, code: 'too-large' });
    });

    it('turns an aborted lookup into a timeout', async () => {
        const controller = new AbortController();
        const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
        dns.lookup.mockImplementation(() => new Promise(() => {
            controller.abort();
        }));
        await expect(fetchProxiedImage('https://example.com/slow.jpg')).rejects.toMatchObject({
            status: 504,
            code: 'timeout',
        });
        timeout.mockRestore();
        dns.lookup.mockReset();
    });
});
