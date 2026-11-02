import { describe, it, expect } from 'vitest';
import { renderSnapBodyHtml } from './renderSnapBodyHtml';

/** Tags stripped in document order, so a reordered sentence fails this. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

const FACTORY = 'https://factory-island-sim.lovable.app';

describe('renderSnapBodyHtml', () => {
  it('returns sanitized html for the text half of a snap', () => {
    const html = renderSnapBodyHtml('hello **world**', 'alice');
    expect(html).toContain('hello');
    expect(html).toContain('world');
    expect(html).not.toContain('**');
  });

  it('returns an empty string when the body is only a photo', () => {
    const html = renderSnapBodyHtml('![pic](https://images.hive.blog/x.jpg)', 'alice');
    expect(html).toBe('');
  });

  it('keeps a short snap in order around a mention and a markdown link', () => {
    const html = renderSnapBodyHtml(
      `Wow @meno - the [Butter Factory](${FACTORY}) is cool`,
      'alice',
    );
    expect(visibleText(html)).toBe('Wow @meno - the Butter Factory is cool');
    expect(html).toContain('href="/@meno"');
    expect(html).toContain(`href="${FACTORY}"`);
    expect(html.indexOf('Wow')).toBeLessThan(html.indexOf('Butter Factory'));
    expect(html.indexOf('Butter Factory')).toBeLessThan(html.indexOf('is cool'));
  });

  it('keeps nearby link, mention, url, and hashtag patterns in order', () => {
    const cases: Array<[string, string]> = [
      [`[Butter Factory](https://example.com/start) is cool`, 'Butter Factory is cool'],
      ['Wow @meno - the [Butter Factory](https://example.com/end)', 'Wow @meno - the Butter Factory'],
      ['See [one](https://a.example/1) and [two](https://b.example/2) now', 'See one and two now'],
      ['Wow @meno see [one](https://a.example/1) and [two](https://b.example/2) now', 'Wow @meno see one and two now'],
      ['Check https://example.com/bare please', 'Check https://example.com/bare please'],
      ['Before https://example.com/bare then [link](https://other.example/x) after', 'Before https://example.com/bare then link after'],
      ['@meno[Butter Factory](https://example.com/adj) tail', '@menoButter Factory tail'],
      ['Wow #hive the [Factory](https://example.com/tag) is cool', 'Wow #hive the Factory is cool'],
    ];
    for (const [body, expected] of cases) {
      expect(visibleText(renderSnapBodyHtml(body, 'alice')), body).toBe(expected);
    }
  });

  it('leaves image and video lines out of the text html without reordering the sentence', () => {
    const html = renderSnapBodyHtml(
      [
        `Wow @meno - the [Butter Factory](${FACTORY}) is cool`,
        '![pic](https://images.hive.blog/x.jpg)',
        'https://play.3speak.tv/watch?v=alice/clip',
      ].join('\n'),
      'alice',
    );
    expect(visibleText(html)).toBe('Wow @meno - the Butter Factory is cool');
    expect(html).not.toContain('images.hive.blog/x.jpg');
    expect(html).not.toContain('3speak.tv');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<video');
  });
});
