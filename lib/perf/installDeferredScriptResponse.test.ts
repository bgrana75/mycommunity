import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installDeferredScriptResponse } from './installDeferredScriptResponse.js';

const HTML = '<!DOCTYPE html><html><head><script src="/_next/static/chunks/app-aaa.js" async=""></script></head><body><p>Hello</p></body></html>';

installDeferredScriptResponse();

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('no port');
      resolve(address.port);
    });
  });
}

describe('installDeferredScriptResponse', () => {
  const servers: Array<ReturnType<typeof createServer>> = [];
  let previousFlag: string | undefined;
  beforeEach(() => {
    previousFlag = process.env.SNAPIE_DEFER_FRAMEWORK_SCRIPTS;
    process.env.SNAPIE_DEFER_FRAMEWORK_SCRIPTS = '1';
  });
  afterEach(() => {
    if (previousFlag === undefined) delete process.env.SNAPIE_DEFER_FRAMEWORK_SCRIPTS;
    else process.env.SNAPIE_DEFER_FRAMEWORK_SCRIPTS = previousFlag;
  });
  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  });

  it('rewrites a plain HTML document', async () => {
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(HTML);
    });
    servers.push(server);
    const port = await listen(server);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('data-snapie-src="/_next/static/chunks/app-aaa.js"');
    expect(text).not.toContain('<script src="/_next/static/chunks/app-aaa.js"');
    expect(text).toContain('<p>Hello</p>');
  });

  it('streams the early HTML through when the rest of the document is slow', async () => {
    const head = '<!DOCTYPE html><html><head><script src="/_next/static/chunks/app-aaa.js" async=""></script></head><body><img src="/photo.jpg"/>';
    const tail = '<p>late</p></body></html>';
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.write(head);
      setTimeout(() => res.end(tail), 600);
    });
    servers.push(server);
    const port = await listen(server);

    const started = Date.now();
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const reader = res.body!.getReader();
    const first = await reader.read();
    const firstAt = Date.now() - started;
    expect(new TextDecoder().decode(first.value)).toContain('<img src="/photo.jpg"/>');
    expect(firstAt).toBeLessThan(500);

    let rest = '';
    for (let r = await reader.read(); !r.done; r = await reader.read()) rest += new TextDecoder().decode(r.value);
    expect(rest).toContain('<p>late</p>');
  });

  it('rewrites a gzipped HTML document and leaves javascript alone', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/app.js') {
        res.setHeader('content-type', 'application/javascript');
        res.setHeader('content-encoding', 'gzip');
        res.end(gzipSync('console.log(1)'));
        return;
      }
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('content-encoding', 'gzip');
      const gz = gzipSync(HTML);
      res.write(gz.subarray(0, 20));
      res.end(gz.subarray(20));
    });
    servers.push(server);
    const port = await listen(server);

    const js = await fetch(`http://127.0.0.1:${port}/app.js`);
    expect(await js.text()).toBe('console.log(1)');

    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    expect(html).toContain('data-snapie-src="/_next/static/chunks/app-aaa.js"');
    expect(html).toContain('DOMContentLoaded');
  });

  it('replaces Content-Length when writeHead already advertised the original size', async () => {
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('content-length', String(Buffer.byteLength(HTML)));
      res.writeHead(200);
      res.end(HTML);
    });
    servers.push(server);
    const port = await listen(server);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(Number(res.headers.get('content-length'))).toBe(Buffer.byteLength(text));
    expect(text).toContain('data-snapie-src="/_next/static/chunks/app-aaa.js"');
    expect(text).toContain('</body></html>');
    expect(text).toContain('DOMContentLoaded');
  });

  it('rewrites home when the flag is unset and leaves scripts when it is 0', async () => {
    delete process.env.SNAPIE_DEFER_FRAMEWORK_SCRIPTS;
    const on = createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(HTML);
    });
    servers.push(on);
    const onText = await (await fetch(`http://127.0.0.1:${await listen(on)}/`)).text();
    expect(onText).toContain('data-snapie-src="/_next/static/chunks/app-aaa.js"');

    process.env.SNAPIE_DEFER_FRAMEWORK_SCRIPTS = '0';
    const off = createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(HTML);
    });
    servers.push(off);
    const offText = await (await fetch(`http://127.0.0.1:${await listen(off)}/`)).text();
    expect(offText).toContain('<script src="/_next/static/chunks/app-aaa.js" async=""></script>');
    expect(offText).not.toContain('data-snapie-src');
  });

  it('does not rewrite HTML for routes other than home', async () => {
    delete process.env.SNAPIE_DEFER_FRAMEWORK_SCRIPTS;
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.writeHead(200);
      res.end(HTML);
    });
    servers.push(server);
    const port = await listen(server);
    const text = await (await fetch(`http://127.0.0.1:${port}/games/snapie-blocks`)).text();
    expect(text).toContain('<script src="/_next/static/chunks/app-aaa.js" async=""></script>');
    expect(text).not.toContain('data-snapie-src');
    expect(text).toContain('<p>Hello</p>');
  });
});
