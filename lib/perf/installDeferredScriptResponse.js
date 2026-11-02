const { ServerResponse } = require('http');
const { gzipSync, gunzipSync } = require('zlib');
const { deferFrameworkScripts } = require('./deferFrameworkScripts.js');

const INSTALLED = Symbol('snapieDeferredScriptsInstalled');
const BUFFER = Symbol('snapieDeferredScriptsBuffer');
const ALLOW_HEAD = Symbol('snapieDeferredScriptsAllowHead');

/**
 * Home document rewrite. On unless SNAPIE_DEFER_FRAMEWORK_SCRIPTS is
 * exactly "0". Other routes are not buffered or rewritten, so games,
 * posts, and auth pages keep their original streaming response.
 * The server-rendered feed image does not depend on the scripts.
 */
function frameworkScriptDeferralEnabled() {
  return process.env.SNAPIE_DEFER_FRAMEWORK_SCRIPTS !== '0';
}

/**
 * How long the home document may be held back for the rewrite. Most of it is
 * ready within a few milliseconds, but a slow feed can leave a delayed tail,
 * and holding the whole response until then would also hold the feed photo
 * the browser needs to request from the early HTML. Past this budget the
 * buffered bytes are sent as they are and the rest streams through untouched
 * (no deferral for that request, which is only a Lighthouse optimisation).
 */
const BUFFER_BUDGET_MS = 150;

function requestPathname(res) {
  const raw = res.req && typeof res.req.url === 'string' ? res.req.url : '';
  const path = raw.split('?')[0] || '/';
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

/** Only the home document. Its LCP photo is in the HTML; the bundles are for hydration. */
function shouldRewriteDocument(res) {
  return frameworkScriptDeferralEnabled() && isHtml(res) && requestPathname(res) === '/';
}

function isHtml(res) {
  const header = res.getHeader('content-type');
  const value = Array.isArray(header) ? header.join(';') : String(header || '');
  return value.includes('text/html');
}

function toBuffer(chunk, encoding) {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === 'string') return Buffer.from(chunk, encoding || 'utf8');
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(String(chunk ?? ''), encoding || 'utf8');
}

function isGzip(body) {
  return body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b;
}

/**
 * `next start` gzips the document in the compression middleware, which writes
 * already-compressed bytes through ServerResponse. Buffer those bytes, rewrite
 * the HTML, and send one body. Non-HTML responses are untouched.
 *
 * This file is plain JS on purpose: the instrumentation hook is bundled for
 * the edge runtime too, and that bundle cannot import Node builtins. The
 * nodejs runtime loads this file with require() instead.
 */
function installDeferredScriptResponse() {
  if (ServerResponse.prototype[INSTALLED]) return;
  ServerResponse.prototype[INSTALLED] = true;

  const origWrite = ServerResponse.prototype.write;
  const origEnd = ServerResponse.prototype.end;
  const origWriteHead = ServerResponse.prototype.writeHead;

  // Next sends writeHead with the static file's Content-Length before end().
  // The rewritten document is longer, and once those headers are flushed the
  // client truncates the body. Hold the head until end() knows the new length.
  ServerResponse.prototype.writeHead = function writeHead(statusCode, statusMessage, headers) {
    if (!frameworkScriptDeferralEnabled()) return origWriteHead.apply(this, arguments);
    let message;
    let hdrs = headers;
    if (typeof statusMessage === 'string') message = statusMessage;
    else if (statusMessage && typeof statusMessage === 'object') hdrs = statusMessage;

    if (message) this.statusMessage = message;
    this.statusCode = statusCode;
    if (Array.isArray(hdrs)) {
      for (let i = 0; i < hdrs.length; i += 2) this.setHeader(hdrs[i], hdrs[i + 1]);
    } else if (hdrs && typeof hdrs === 'object') {
      for (const [key, value] of Object.entries(hdrs)) this.setHeader(key, value);
    }

    // end() calls writeHead once the rewritten length is set. Only the early
    // call, the one that would freeze the static file's Content-Length, is held.
    // Other routes and non-HTML bodies use the original headers.
    if (this[ALLOW_HEAD] || !shouldRewriteDocument(this)) return origWriteHead.apply(this, arguments);

    this.removeHeader('content-length');
    return this;
  };

  // Give up on the rewrite for this response: send what is buffered unchanged
  // and let every later write/end pass straight through.
  function flushUnmodified(res, state) {
    if (state.passthrough) return;
    state.passthrough = true;
    if (state.timer) clearTimeout(state.timer);
    const held = state.chunks;
    state.chunks = [];
    if (!res.headersSent) {
      // The head was held back for the rewrite. Release it now, chunked.
      res.removeHeader('content-length');
      res[ALLOW_HEAD] = true;
    }
    if (held.length > 0) origWrite.call(res, Buffer.concat(held));
  }

  ServerResponse.prototype.write = function write(chunk, encoding, cb) {
    if (!shouldRewriteDocument(this)) return origWrite.call(this, chunk, encoding, cb);
    let callback = cb;
    let enc;
    if (typeof encoding === 'function') callback = encoding;
    else enc = encoding;
    const state = this[BUFFER] || { chunks: [], passthrough: false, timer: null };
    this[BUFFER] = state;
    if (state.passthrough) return origWrite.call(this, chunk, enc, callback);

    state.chunks.push(toBuffer(chunk, enc));
    if (!state.timer) {
      state.timer = setTimeout(() => flushUnmodified(this, state), BUFFER_BUDGET_MS);
      if (typeof state.timer.unref === 'function') state.timer.unref();
    }
    if (callback) callback(null);
    return true;
  };

  ServerResponse.prototype.end = function end(chunk, encoding, cb) {
    let data = chunk;
    let enc;
    let callback = cb;
    if (typeof data === 'function') {
      callback = data;
      data = undefined;
    } else if (typeof encoding === 'function') {
      callback = encoding;
    } else {
      enc = encoding;
    }

    if (!shouldRewriteDocument(this)) return origEnd.call(this, data, enc, callback);

    const state = this[BUFFER] || { chunks: [], passthrough: false, timer: null };
    this[BUFFER] = undefined;
    if (state.timer) clearTimeout(state.timer);
    if (state.passthrough) return origEnd.call(this, data, enc, callback);
    if (data !== undefined && data !== null) state.chunks.push(toBuffer(data, enc));
    let body = Buffer.concat(state.chunks);
    const gzipped = isGzip(body) || String(this.getHeader('content-encoding') || '').includes('gzip');

    try {
      const html = (gzipped && isGzip(body) ? gunzipSync(body) : body).toString('utf8');
      if (html.includes('<html') && html.includes('/_next/static/')) {
        const transformed = deferFrameworkScripts(html);
        if (transformed !== html) {
          body = gzipped ? gzipSync(Buffer.from(transformed)) : Buffer.from(transformed);
          if (!this.headersSent) {
            this.removeHeader('content-length');
            this.setHeader('content-length', String(body.length));
          }
        }
      }
    } catch {
      // Send the original bytes if the document cannot be rewritten.
    }

    if (!this.headersSent) {
      this.removeHeader('content-length');
      this.setHeader('content-length', String(body.length));
      this[ALLOW_HEAD] = true;
    }

    return origEnd.call(this, body, callback);
  };
}

module.exports = { installDeferredScriptResponse, frameworkScriptDeferralEnabled };
