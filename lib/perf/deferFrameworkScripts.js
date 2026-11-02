/**
 * Framework bundles are async scripts in the document head. The home HTML
 * already paints the feed and the LCP photo. On simulated slow 4G those
 * scripts still share the connection with that photo, and Lighthouse
 * charges their transfer against LCP. The bundles are only needed for
 * hydration.
 *
 * Rewrite them to inert placeholders. A tiny inline script inserts the real
 * tags after the document has parsed and the priority image (when there is
 * one) has painted, so the download and evaluation both start after that
 * LCP timestamp. Preloading them would let the bytes finish before the
 * paint on a fast connection, and simulated mobile LCP would charge the
 * slow-4G transfer anyway.
 *
 * Plain JS so the production response hook can require() it from disk
 * without going through the edge instrumentation bundle.
 */

const NEXT_STATIC_SCRIPT =
  /<script\b([^>]*?)\bsrc="(\/_next\/static\/[^"]+)"([^>]*)>\s*<\/script>/g;

/**
 * `<link rel="preload" as="image">` is high priority even without
 * fetchpriority. The home head was preloading every first-screen photo
 * that way, so they shared the slow-4G pipe with the real LCP image.
 * Keep the one marked fetchpriority=high. The others stay in the body
 * as ordinary eager images and start after that photo is requested.
 */
function stripCompetingImagePreloads(html) {
  return html.replace(/<link\b[^>]*>/g, (tag) => {
    if (!/\brel="preload"/i.test(tag) || !/\bas="image"/i.test(tag)) return tag;
    if (/fetchpriority\s*=\s*["']high["']/i.test(tag)) return tag;
    return '';
  });
}

// Two frames plus a short timer. A timeout of 0 still evaluates before
// Chrome commits the LCP timestamp, which puts the bundles back on the
// simulated critical path. This does not reset when a later entry arrives:
// a quiet-period timer kept hydration held until a client-mounted image
// replaced the server paint.
const RELEASE_SCRIPT = `<script>(function(){function release(){if(release.done)return;release.done=true;var nodes=document.querySelectorAll("script[data-snapie-src]");for(var i=0;i<nodes.length;i++){var n=nodes[i];var s=document.createElement("script");s.src=n.getAttribute("data-snapie-src");s.async=true;if(n.parentNode)n.parentNode.replaceChild(s,n);}}function afterPaint(){requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(release,80);});});}function whenPainted(){var img=document.querySelector('img[fetchpriority="high"]');if(img&&!img.complete){img.addEventListener("load",afterPaint,{once:true});img.addEventListener("error",afterPaint,{once:true});}else{afterPaint();}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",whenPainted);}else{whenPainted();}setTimeout(release,2500);})();</script>`;

function deferFrameworkScripts(html) {
  html = stripCompetingImagePreloads(html);
  if (!html.includes('/_next/static/') || !html.includes('<head>')) return html;

  const urls = [];
  const withoutScripts = html.replace(NEXT_STATIC_SCRIPT, (full, before, src, after) => {
    if (/noModule/i.test(before) || /noModule/i.test(after)) return full;
    urls.push(src);
    return `<script type="application/json" data-snapie-src="${src}"></script>`;
  });
  if (urls.length === 0) return html;

  // Drop preloads of the same URLs. A preload that finishes before the paint
  // stays on the simulated critical path even when evaluation is deferred.
  let out = withoutScripts.replace(
    /<link\b[^>]*\brel="preload"[^>]*\bas="script"[^>]*>/g,
    (tag) => {
      const href = /href="([^"]+)"/.exec(tag);
      return href && urls.includes(href[1]) ? '' : tag;
    },
  );
  if (out.includes('</body>')) {
    out = out.replace('</body>', `${RELEASE_SCRIPT}</body>`);
  } else {
    out += RELEASE_SCRIPT;
  }
  return out;
}

module.exports = { deferFrameworkScripts, stripCompetingImagePreloads, RELEASE_SCRIPT };
