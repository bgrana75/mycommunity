/**
 * Server-side fetch for `/api/image-proxy`.
 *
 * The browser only ever asks our own origin for feed images (`next/image`
 * → `/_next/image` → this proxy). This module is what talks to the upstream
 * URL, so it is the SSRF boundary:
 *
 * - http/https only; credentials, back-references to this proxy, and
 *   `/_next/image` are rejected (no open redirect, no optimizer loop)
 * - obvious internal hostnames are rejected before DNS
 * - every resolved address is checked against a blocklist (loopback,
 *   RFC1918, link-local including cloud metadata, CGNAT, unique-local IPv6,
 *   multicast, reserved). If any address is blocked, the host is refused
 * - the TCP connection is pinned to that validated address so a second DNS
 *   lookup cannot rebind to a private IP
 * - redirects are followed manually (capped) and each hop is re-checked
 * - size, timeout, declared content-type, and magic-byte checks; raster
 *   images only (no SVG)
 *
 * When the original URL fails with an upstream 4xx/5xx, a non-image body,
 * or a transport error, one retry goes to Hive's public cache
 * (`https://images.hive.blog/0x0/<original>`). That hop uses the same SSRF
 * checks, size cap, and timeout. A URL that is already on images.hive.blog
 * is not sent there again. A known generic stand-in body from that host is
 * a failure, so the UI can show its own fallback instead of Hive's picture.
 *
 * Successful fetches can be kept in a short in-memory cache (the default
 * deps use one). Callers that pass their own deps, including tests, do not
 * share it. The cache does not change which URLs are allowed.
 */
import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress, LookupOptions } from 'node:dns';
import { BlockList, isIP } from 'node:net';

const TIMEOUT_MS = 8_000;
const DNS_TIMEOUT_MS = 2_000;
const MAX_REDIRECTS = 3;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const PUBLIC_MESSAGE: Record<number, string> = {
    400: 'Invalid image url',
    403: 'Image host is not allowed',
    404: 'Image not found',
    413: 'Image is too large',
    415: 'Unsupported image type',
    502: 'Image fetch failed',
    504: 'Image fetch timed out',
};

export class ImageProxyError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string) {
        super(PUBLIC_MESSAGE[status] ?? 'Image fetch failed');
        this.name = 'ImageProxyError';
        this.status = status;
        this.code = code;
    }
}

const BLOCK_LIST = new BlockList();
BLOCK_LIST.addSubnet('0.0.0.0', 8, 'ipv4');
BLOCK_LIST.addSubnet('10.0.0.0', 8, 'ipv4');
BLOCK_LIST.addSubnet('100.64.0.0', 10, 'ipv4');
BLOCK_LIST.addSubnet('127.0.0.0', 8, 'ipv4');
BLOCK_LIST.addSubnet('169.254.0.0', 16, 'ipv4');
BLOCK_LIST.addSubnet('172.16.0.0', 12, 'ipv4');
BLOCK_LIST.addSubnet('192.0.0.0', 24, 'ipv4');
BLOCK_LIST.addSubnet('192.0.2.0', 24, 'ipv4');
BLOCK_LIST.addSubnet('192.168.0.0', 16, 'ipv4');
BLOCK_LIST.addSubnet('198.18.0.0', 15, 'ipv4');
BLOCK_LIST.addSubnet('198.51.100.0', 24, 'ipv4');
BLOCK_LIST.addSubnet('203.0.113.0', 24, 'ipv4');
BLOCK_LIST.addSubnet('224.0.0.0', 4, 'ipv4');
BLOCK_LIST.addSubnet('240.0.0.0', 4, 'ipv4');
BLOCK_LIST.addAddress('::', 'ipv6');
BLOCK_LIST.addAddress('::1', 'ipv6');
BLOCK_LIST.addSubnet('fc00::', 7, 'ipv6');
BLOCK_LIST.addSubnet('fe80::', 10, 'ipv6');
BLOCK_LIST.addSubnet('fec0::', 10, 'ipv6');
BLOCK_LIST.addSubnet('ff00::', 8, 'ipv6');
BLOCK_LIST.addSubnet('2001:db8::', 32, 'ipv6');

const BLOCKED_HOSTS = new Set([
    'localhost',
    'localhost.localdomain',
    'metadata',
    'metadata.google.internal',
    'metadata.google.com',
    'instance-data',
    'kubernetes',
    'kubernetes.default',
    'kubernetes.default.svc',
    'host.docker.internal',
    'gateway.docker.internal',
]);

const BLOCKED_SUFFIXES = [
    '.local',
    '.localhost',
    '.localdomain',
    '.internal',
    '.intranet',
    '.home.arpa',
    '.cluster.local',
    '.svc',
];

export type ProxyAddress = { address: string; family: 4 | 6 };

export type ProxyUpstream = {
    status: number;
    location?: string;
    contentType?: string;
    contentLength?: number | null;
    body: Buffer;
};

export type ProxiedImage = {
    body: Buffer;
    contentType: string;
    /** Set when the bytes came from Hive's cache after the original URL failed. */
    fallback?: 'hive';
};

/**
 * sha256 hex of a generic image images.hive.blog may return with HTTP 200
 * for a URL it does not actually have. Observed on 2026-10-06, uncached
 * misses are 403 text/plain or 400 JSON (already rejected by the status
 * and content-type checks), not a 200 stand-in, so this set starts empty.
 * A digest added here is treated as a miss.
 */
export const HIVE_PLACEHOLDER_SHA256: ReadonlySet<string> = new Set();

const HIVE_IMAGE_HOST = 'images.hive.blog';

/**
 * Hivemoji renders any `:word:` the post-body regex matches, including
 * plain text (a time like `10:30:00` yields `:30:`), as an `<img>` pointed
 * here — most never existed, so a miss is routine, not a dead link worth
 * chasing. Skip it: the Hive-cache retry would only add a second request
 * that also misses (unlike a real CDN image Hive may have already cached).
 */
const HIVEMOJI_HOST = 'hivemoji.hivelytics.io';

/** Failures worth one Hive-cache retry. Policy rejections are not. */
const HIVE_FALLBACK_CODES = new Set([
    'upstream-status',
    'not-image',
    'content-type',
    'upstream-error',
    'dns-failed',
    'dns-empty',
    'timeout',
    'dns-timeout',
]);

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 8;
const CACHE_MAX_BYTES = 4 * 1024 * 1024;

type CacheEntry = {
    body: Buffer;
    contentType: string;
    expires: number;
    fallback?: 'hive';
};
export type ProxiedImageCache = Map<string, CacheEntry>;

export type ImageProxyDeps = {
    resolve: (hostname: string, signal: AbortSignal) => Promise<ProxyAddress[]>;
    request: (target: URL, address: ProxyAddress, signal: AbortSignal) => Promise<ProxyUpstream>;
    /** Defaults to {@link HIVE_PLACEHOLDER_SHA256}. */
    placeholderHashes?: ReadonlySet<string>;
    /** Successful images only. Omitted deps do not cache. */
    cache?: ProxiedImageCache;
};

const sharedCache: ProxiedImageCache = new Map();

function readCache(cache: ProxiedImageCache | undefined, key: string): ProxiedImage | null {
    if (!cache) return null;
    const hit = cache.get(key);
    if (!hit) return null;
    if (hit.expires <= Date.now()) {
        cache.delete(key);
        return null;
    }
    cache.delete(key);
    cache.set(key, hit);
    return { body: hit.body, contentType: hit.contentType, fallback: hit.fallback };
}

function writeCache(cache: ProxiedImageCache | undefined, key: string, value: ProxiedImage): void {
    if (!cache) return;
    if (value.body.length === 0 || value.body.length > CACHE_MAX_BYTES) return;
    cache.delete(key);
    cache.set(key, {
        body: value.body,
        contentType: value.contentType,
        expires: Date.now() + CACHE_TTL_MS,
        fallback: value.fallback,
    });
    while (cache.size > CACHE_MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
    }
}

export function sha256Hex(body: Buffer): string {
    return createHash('sha256').update(body).digest('hex');
}

export function isHivePlaceholderImage(body: Buffer, hashes: ReadonlySet<string> = HIVE_PLACEHOLDER_SHA256): boolean {
    return hashes.size > 0 && hashes.has(sha256Hex(body));
}

/**
 * Hive cache URL for an original that is not already on images.hive.blog.
 * The original href is appended raw (`/0x0/https://...`), which is the
 * form that host serves. Returns null when a retry would point at itself.
 */
export function hiveImageFallbackUrl(originalHref: string): string | null {
    let original: URL;
    try {
        original = new URL(originalHref);
    } catch {
        return null;
    }
    if (normalizeHostname(original.hostname) === HIVE_IMAGE_HOST) return null;
    return `https://${HIVE_IMAGE_HOST}/0x0/${original.href}`;
}

function normalizeHostname(hostname: string): string {
    let host = hostname.trim().toLowerCase();
    if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
    if (host.endsWith('.')) host = host.slice(0, -1);
    return host;
}

/** True for private, loopback, link-local, metadata, multicast, and reserved addresses. Non-IPs fail closed. */
export function isBlockedIpAddress(raw: string): boolean {
    const address = normalizeHostname(raw);
    const family = isIP(address);
    if (family === 4) return BLOCK_LIST.check(address, 'ipv4');
    if (family === 6) return BLOCK_LIST.check(address, 'ipv6');
    return true;
}

/** Obvious internal names. IP literals are not handled here. */
export function isBlockedHostname(hostname: string): boolean {
    const host = normalizeHostname(hostname);
    if (!host) return true;
    if (BLOCKED_HOSTS.has(host)) return true;
    return BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function isRecursiveProxyPath(pathname: string): boolean {
    const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';
    return path === '/api/image-proxy' || path === '/_next/image' || path.startsWith('/_next/image/');
}

/** Synchronous URL policy. DNS and the connection happen later. */
export function assertSafeProxyUrl(rawUrl: string): URL {
    const raw = rawUrl.trim();
    if (!raw || raw.length > 2048 || /[\u0000-\u001F\u007F\\]/.test(raw)) {
        throw new ImageProxyError(400, 'invalid-url');
    }

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new ImageProxyError(400, 'invalid-url');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new ImageProxyError(400, 'bad-scheme');
    }
    if (url.username || url.password) {
        throw new ImageProxyError(400, 'credentials');
    }
    if (isRecursiveProxyPath(url.pathname)) {
        throw new ImageProxyError(400, 'recursive-proxy');
    }

    const host = normalizeHostname(url.hostname);
    if (!host) throw new ImageProxyError(400, 'invalid-url');

    if (isIP(host)) {
        if (isBlockedIpAddress(host)) throw new ImageProxyError(403, 'blocked-ip');
        return url;
    }
    if (isBlockedHostname(host)) throw new ImageProxyError(403, 'blocked-host');
    return url;
}

function sniffImageType(buffer: Buffer): string | null {
    if (buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
    if (
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
        buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
    ) {
        return 'image/png';
    }
    const gif = buffer.toString('ascii', 0, 6);
    if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif';
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    if (buffer.toString('ascii', 4, 8) === 'ftyp') {
        const brand = buffer.toString('ascii', 8, 12);
        if (brand === 'avif' || brand === 'avis') return 'image/avif';
    }
    return null;
}

const ALLOWED_DECLARED = new Set([
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'application/octet-stream',
    'binary/octet-stream',
    'application/binary',
]);

function declaredContentType(header: string | undefined): string | null {
    if (!header) return null;
    return header.split(';')[0].trim().toLowerCase() || null;
}

function acceptImage(upstream: ProxyUpstream): { body: Buffer; contentType: string } {
    if (
        (upstream.contentLength != null && (!Number.isFinite(upstream.contentLength) || upstream.contentLength > MAX_IMAGE_BYTES)) ||
        upstream.body.length > MAX_IMAGE_BYTES
    ) {
        throw new ImageProxyError(413, 'too-large');
    }
    const sniffed = sniffImageType(upstream.body);
    if (!sniffed) throw new ImageProxyError(415, 'not-image');
    const declared = declaredContentType(upstream.contentType);
    if (declared && !ALLOWED_DECLARED.has(declared)) {
        throw new ImageProxyError(415, 'content-type');
    }
    return { body: upstream.body, contentType: sniffed };
}

async function defaultResolve(hostname: string, signal: AbortSignal): Promise<ProxyAddress[]> {
    if (signal.aborted) throw new ImageProxyError(504, 'timeout');
    const records = await new Promise<LookupAddress[]>((resolve, reject) => {
        const timer = setTimeout(() => reject(new ImageProxyError(504, 'dns-timeout')), DNS_TIMEOUT_MS);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new ImageProxyError(504, 'timeout'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        dnsLookup(hostname, { all: true, verbatim: true }).then(
            (value) => {
                clearTimeout(timer);
                signal.removeEventListener('abort', onAbort);
                resolve(value);
            },
            (err: unknown) => {
                clearTimeout(timer);
                signal.removeEventListener('abort', onAbort);
                reject(err);
            },
        );
    });
    return records.map((record) => ({
        address: record.address,
        family: record.family === 6 ? 6 : 4,
    }));
}

function headerOne(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

function defaultRequest(target: URL, address: ProxyAddress, signal: AbortSignal): Promise<ProxyUpstream> {
    const lib = target.protocol === 'https:' ? https : http;
    const agent = new lib.Agent({ keepAlive: false });

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            agent.destroy();
            fn();
        };
        const fail = (err: unknown) => {
            finish(() => {
                if (err instanceof ImageProxyError) {
                    reject(err);
                    return;
                }
                if (signal.aborted || (err instanceof Error && (err.name === 'AbortError' || err.message === 'aborted'))) {
                    reject(new ImageProxyError(504, 'timeout'));
                    return;
                }
                reject(new ImageProxyError(502, 'upstream-error'));
            });
        };

        const req = lib.request(
            target,
            {
                method: 'GET',
                agent,
                // Pin the socket to the address we already checked. A second
                // DNS lookup here would reopen a rebinding window.
                lookup: ((
                    _hostname: string,
                    options: LookupOptions | ((err: NodeJS.ErrnoException | null, address: string, family: number) => void),
                    callback?: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
                ) => {
                    const pinned = address.address;
                    const family = address.family;
                    if (typeof options === 'function') {
                        options(null, pinned, family);
                        return;
                    }
                    if (!callback) return;
                    if (options.all) {
                        callback(null, [{ address: pinned, family }]);
                        return;
                    }
                    callback(null, pinned, family);
                }) as http.RequestOptions['lookup'],
                headers: {
                    Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.1',
                    'User-Agent': 'Mozilla/5.0 (compatible; SnapieImageProxy/1.0; +https://snapie.io)',
                },
                signal,
            },
            (res) => {
                const status = res.statusCode ?? 0;
                const location = headerOne(res.headers.location);
                const contentType = headerOne(res.headers['content-type']);
                const lengthHeader = headerOne(res.headers['content-length']);
                const contentLength = lengthHeader == null || lengthHeader === '' ? null : Number(lengthHeader);

                if (contentLength != null && (!Number.isFinite(contentLength) || contentLength > MAX_IMAGE_BYTES)) {
                    res.destroy();
                    finish(() => reject(new ImageProxyError(413, 'too-large')));
                    return;
                }

                if (status >= 300 && status < 400) {
                    res.resume();
                    res.on('error', fail);
                    res.on('end', () => {
                        finish(() => resolve({
                            status,
                            location,
                            contentType,
                            contentLength,
                            body: Buffer.alloc(0),
                        }));
                    });
                    return;
                }

                const chunks: Buffer[] = [];
                let received = 0;
                res.on('data', (chunk: Buffer) => {
                    received += chunk.length;
                    if (received > MAX_IMAGE_BYTES) {
                        res.destroy();
                        finish(() => reject(new ImageProxyError(413, 'too-large')));
                        return;
                    }
                    chunks.push(chunk);
                });
                res.on('error', fail);
                res.on('end', () => {
                    finish(() => resolve({
                        status,
                        location,
                        contentType,
                        contentLength,
                        body: Buffer.concat(chunks),
                    }));
                });
            },
        );

        req.setTimeout(TIMEOUT_MS, () => {
            req.destroy(new ImageProxyError(504, 'timeout'));
        });
        req.on('error', fail);
        req.end();
    });
}

const defaultDeps: ImageProxyDeps = {
    resolve: defaultResolve,
    request: defaultRequest,
    cache: sharedCache,
};

async function resolvePublicAddress(url: URL, deps: ImageProxyDeps, signal: AbortSignal): Promise<ProxyAddress> {
    const host = normalizeHostname(url.hostname);
    if (isIP(host)) {
        if (isBlockedIpAddress(host)) throw new ImageProxyError(403, 'blocked-ip');
        return { address: host, family: isIP(host) === 6 ? 6 : 4 };
    }

    let records: ProxyAddress[];
    try {
        records = await deps.resolve(host, signal);
    } catch (err) {
        if (err instanceof ImageProxyError) throw err;
        throw new ImageProxyError(502, 'dns-failed');
    }
    if (!records.length) throw new ImageProxyError(502, 'dns-empty');
    for (const record of records) {
        if (!record.address || isBlockedIpAddress(record.address)) {
            throw new ImageProxyError(403, 'blocked-resolved-ip');
        }
    }
    return records[0];
}

async function fetchProxiedOnce(
    start: URL,
    deps: ImageProxyDeps,
    signal: AbortSignal,
): Promise<{ body: Buffer; contentType: string }> {
    let current = start;

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
        const address = await resolvePublicAddress(current, deps, signal);
        const upstream = await deps.request(current, address, signal);

        if (upstream.status >= 300 && upstream.status < 400) {
            if (redirect === MAX_REDIRECTS || !upstream.location) {
                throw new ImageProxyError(502, 'too-many-redirects');
            }
            let next: URL;
            try {
                next = new URL(upstream.location, current);
            } catch {
                throw new ImageProxyError(400, 'invalid-url');
            }
            current = assertSafeProxyUrl(next.href);
            continue;
        }

        if (upstream.status !== 200) {
            if (upstream.status === 404 && normalizeHostname(current.hostname) === HIVEMOJI_HOST) {
                throw new ImageProxyError(404, 'hivemoji-missing');
            }
            throw new ImageProxyError(502, 'upstream-status');
        }
        return acceptImage(upstream);
    }

    throw new ImageProxyError(502, 'too-many-redirects');
}

function canRetryViaHive(err: unknown): err is ImageProxyError {
    return err instanceof ImageProxyError && HIVE_FALLBACK_CODES.has(err.code);
}

export async function fetchProxiedImage(
    rawUrl: string,
    deps: ImageProxyDeps = defaultDeps,
): Promise<ProxiedImage> {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const original = assertSafeProxyUrl(rawUrl);
    const cacheKey = original.href;
    const cached = readCache(deps.cache, cacheKey);
    if (cached) return cached;

    try {
        const image = await fetchProxiedOnce(original, deps, signal);
        writeCache(deps.cache, cacheKey, image);
        return image;
    } catch (err) {
        if (!canRetryViaHive(err)) throw err;
        const fallbackHref = hiveImageFallbackUrl(original.href);
        if (!fallbackHref) throw err;

        let fallbackUrl: URL;
        try {
            fallbackUrl = assertSafeProxyUrl(fallbackHref);
        } catch {
            throw err;
        }

        let image: { body: Buffer; contentType: string };
        try {
            image = await fetchProxiedOnce(fallbackUrl, deps, signal);
        } catch {
            throw err;
        }
        if (isHivePlaceholderImage(image.body, deps.placeholderHashes)) {
            throw new ImageProxyError(502, 'hive-placeholder');
        }
        const viaHive: ProxiedImage = { ...image, fallback: 'hive' };
        writeCache(deps.cache, cacheKey, viaHive);
        return viaHive;
    }
}

/**
 * Whether `rawUrl` is an image this proxy is willing to serve.
 * Failures (missing file, blocked host, non-image) are `false` rather than
 * a thrown status, so a caller can answer the browser with HTTP 200.
 * Unexpected errors still throw. Uses the same checks as `fetchProxiedImage`.
 */
export async function probeProxiedImage(
    rawUrl: string,
    deps: ImageProxyDeps = defaultDeps,
): Promise<boolean> {
    try {
        await fetchProxiedImage(rawUrl, deps);
        return true;
    } catch (err) {
        if (err instanceof ImageProxyError) return false;
        throw err;
    }
}
