import { describe, expect, it } from 'vitest';
import { deferFrameworkScripts } from './deferFrameworkScripts.js';

const SAMPLE = `<!DOCTYPE html><html><head><link rel="preload" as="script" fetchPriority="low" href="/_next/static/chunks/webpack-aaa.js"/><script src="/_next/static/chunks/webpack-aaa.js" async=""></script><script src="/_next/static/chunks/main-bbb.js" async=""></script><script src="/_next/static/chunks/polyfills-ccc.js" noModule=""></script></head><body><script>self.__next_f.push(1)</script><p>Street art in town</p><script src="https://example.com/extra.js" async=""></script></body></html>`;

describe('deferFrameworkScripts', () => {
  it('keeps framework scripts from evaluating until the server paint is committed', () => {
    const out = deferFrameworkScripts(SAMPLE);

    expect(out).not.toContain('<script src="/_next/static/chunks/webpack-aaa.js"');
    expect(out).not.toContain('<script src="/_next/static/chunks/main-bbb.js"');
    expect(out).toContain('data-snapie-src="/_next/static/chunks/webpack-aaa.js"');
    expect(out).toContain('data-snapie-src="/_next/static/chunks/main-bbb.js"');
    expect(out).toContain('type="application/json"');

    expect(out).toContain('<script src="/_next/static/chunks/polyfills-ccc.js" noModule=""></script>');
    expect(out).toContain('self.__next_f.push(1)');
    expect(out).toContain('<script src="https://example.com/extra.js" async=""></script>');
    expect(out).toContain('Street art in town');

    expect(out).not.toContain('rel="preload" as="script"');
    expect(out).not.toContain('webpack-aaa.js"/>');

    expect(out).toContain('DOMContentLoaded');
    expect(out).toContain('img[fetchpriority="high"]');
    expect(out).toContain('setTimeout(release,80)');
    expect(out).not.toContain('setTimeout(release,400)');
    expect(out.indexOf('data-snapie-src')).toBeLessThan(out.lastIndexOf('DOMContentLoaded'));
    expect(out.includes('</script></body>')).toBe(true);
  });

  it('leaves documents without framework scripts alone', () => {
    const html = '<html><head></head><body><p>Hi</p></body></html>';
    expect(deferFrameworkScripts(html)).toBe(html);
  });

  it('keeps only the high-priority image preload', () => {
    const html = '<!DOCTYPE html><html><head><link rel="preload" as="image" imageSrcSet="/_next/image?url=other 640w"/><link rel="preload" href="/_next/image?url=lcp&amp;w=640&amp;q=75" as="image" fetchPriority="high"/><script src="/_next/static/chunks/main-bbb.js" async=""></script></head><body><p>Street art in town</p></body></html>';
    const out = deferFrameworkScripts(html);
    expect(out).not.toContain('imageSrcSet="/_next/image?url=other');
    expect(out).toContain('fetchPriority="high"');
    expect(out).toContain('data-snapie-src="/_next/static/chunks/main-bbb.js"');
    expect(out).toContain('Street art in town');
  });
});
