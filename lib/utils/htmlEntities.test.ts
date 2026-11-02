import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from './htmlEntities';

describe('decodeHtmlEntities', () => {
  it('decodes spacing and XML entities', () => {
    expect(decodeHtmlEntities('a&emsp;b&nbsp;c &amp; d &lt;e&gt; &quot;f&quot; g&apos;s')).toBe('a b c & d <e> "f" g\'s');
  });

  it('decodes numeric references', () => {
    expect(decodeHtmlEntities('&#65;&#x42;&#x1F600;')).toBe('AB😀');
  });

  it('decodes once, so an escaped entity is not decoded twice', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
  });

  it('leaves unknown names and invalid code points as written', () => {
    expect(decodeHtmlEntities('&bogus; &#0; &#x110000;')).toBe('&bogus; &#0; &#x110000;');
  });
});
