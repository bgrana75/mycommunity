import { describe, expect, it } from 'vitest';
import markdownRenderer from './MarkdownRenderer';
import { IMAGE_PROXY_PATH } from '@/lib/images/feedImageSrc';

const PAREN_URL = 'https://images.hive.blog/DQmerj5ka4MkkXwTr5atPeNe3eVVwXWA2LGogbTWDHz9h9y/Screenshot%20(88).jpg';

describe('markdownRenderer image srcs', () => {
    it('routes markdown and html images through the proxy, including parentheses', () => {
        const html = markdownRenderer(
            `![peakd](https://files.peakd.com/file/a.jpg)\n\n<img src="https://i.ecency.com/x.jpg">\n\n![](${PAREN_URL})`,
        );
        expect(html).toContain(`${IMAGE_PROXY_PATH}?url=`);
        expect(html).toContain(encodeURIComponent('https://files.peakd.com/file/a.jpg'));
        expect(html).toContain(encodeURIComponent('https://i.ecency.com/x.jpg'));
        expect(html).toContain(encodeURIComponent(PAREN_URL));
        expect(html).not.toContain('src="https://files.peakd.com');
        expect(html).not.toContain('src="https://i.ecency.com');
        expect(html).not.toContain('images.hive.blog/0x0/');
        expect(html).not.toContain('Screenshot%20(88');
    });

    it('routes hivemoji images through the proxy', () => {
        const html = markdownRenderer(':wave:', { defaultEmojiOwner: 'alice' });
        expect(html).toContain('hivemoji');
        expect(html).toContain(`${IMAGE_PROXY_PATH}?url=`);
        expect(html).not.toContain('src="https://hivemoji.hivelytics.io');
    });
});

/** Tags stripped in document order, so a reordered sentence fails this. */
function visibleText(html: string): string {
    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

const FACTORY = 'https://factory-island-sim.lovable.app';

describe('markdownRenderer inline order', () => {
    it('keeps mention, markdown link, and trailing text in source order', () => {
        const html = markdownRenderer(`Wow @meno - the [Butter Factory](${FACTORY}) is cool`);
        expect(visibleText(html)).toBe('Wow @meno - the Butter Factory is cool');
        expect(html).toContain('href="/@meno"');
        expect(html).toContain(`href="${FACTORY}"`);
        expect(html.indexOf('Wow')).toBeLessThan(html.indexOf('Butter Factory'));
        expect(html.indexOf('Butter Factory')).toBeLessThan(html.indexOf('is cool'));
    });

    it('keeps a link at the start or the end in source order', () => {
        expect(visibleText(markdownRenderer('[Butter Factory](https://example.com/start) is cool'))).toBe(
            'Butter Factory is cool',
        );
        expect(visibleText(markdownRenderer('Wow @meno - the [Butter Factory](https://example.com/end)'))).toBe(
            'Wow @meno - the Butter Factory',
        );
    });

    it('keeps two links in source order, including a mention before them', () => {
        expect(visibleText(markdownRenderer('See [one](https://a.example/1) and [two](https://b.example/2) now'))).toBe(
            'See one and two now',
        );
        expect(
            visibleText(markdownRenderer('Wow @meno see [one](https://a.example/1) and [two](https://b.example/2) now')),
        ).toBe('Wow @meno see one and two now');
    });

    it('keeps a bare url in place, including one beside a markdown link', () => {
        expect(visibleText(markdownRenderer('Check https://example.com/bare please'))).toBe(
            'Check https://example.com/bare please',
        );
        const html = markdownRenderer('Before https://example.com/bare then [link](https://other.example/x) after');
        expect(visibleText(html)).toBe('Before https://example.com/bare then link after');
        expect(html).toContain('href="https://example.com/bare"');
        expect(html).toContain('href="https://other.example/x"');
    });

    it('keeps an @mention written directly against a markdown link', () => {
        const html = markdownRenderer('@meno[Butter Factory](https://example.com/adj) tail');
        expect(visibleText(html)).toBe('@menoButter Factory tail');
        expect(html.indexOf('href="/@meno"')).toBeLessThan(html.indexOf('href="https://example.com/adj"'));
    });

    it('keeps a hashtag in place beside a markdown link', () => {
        const html = markdownRenderer('Wow #hive the [Factory](https://example.com/tag) is cool');
        expect(visibleText(html)).toBe('Wow #hive the Factory is cool');
        expect(html).toContain('href="/trending/hive"');
        expect(html.indexOf('#hive')).toBeLessThan(html.indexOf('Factory'));
        expect(html.indexOf('Factory')).toBeLessThan(html.indexOf('is cool'));
    });
});

describe('markdownRenderer embeds and sanitizing', () => {
    it('turns a 3speak watch url into a video iframe', () => {
        const html = markdownRenderer('https://play.3speak.tv/watch?v=alice/clip');
        expect(html).toContain('video-container');
        expect(html).toContain('<iframe');
        expect(html).toContain('alice/clip');
    });

    it('turns a youtube url into an embed iframe', () => {
        const html = markdownRenderer('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
        expect(html).toContain('<iframe');
        expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ');
    });

    it('turns an ipfs iframe into a video element', () => {
        const html = markdownRenderer(
            '<iframe src="https://ipfs.3speak.tv/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"></iframe>',
        );
        expect(html).toContain('<video');
        expect(html).toContain('QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
        expect(html).not.toContain('<iframe');
    });

    it('strips event handlers and overlay positioning', () => {
        const html = markdownRenderer(
            '<div style="position:fixed;z-index:9;color:red">hi</div><img src="https://example.com/a.jpg" onerror="alert(1)">',
        );
        expect(html).toContain('hi');
        expect(html).toContain('<img');
        expect(html).not.toContain('onerror');
        expect(html).not.toContain('position');
        expect(html).not.toContain('z-index');
        expect(html).not.toContain('<script');
    });
});
