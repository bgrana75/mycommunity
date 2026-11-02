import { describe, expect, it } from 'vitest';
import { buildPostMetadata } from './buildMetadata';

const post = (body: string) => buildPostMetadata({ title: 'T', body, author: 'alice', permlink: 'p' });

describe('buildPostMetadata description', () => {
  it('strips raw and malformed HTML tags', () => {
    const { description } = post('<center <div class="x" style="a:b">Hello world</div></center>');
    expect(description).toBe('Hello world');
  });

  it('decodes entities and collapses the whitespace they leave', () => {
    const { description } = post('&emsp;&emsp;Fish &amp; chips&nbsp;&nbsp;today');
    expect(description).toBe('Fish & chips today');
  });

  it('still strips markdown', () => {
    const { description } = post('## Title\n\n**bold** [link](https://x.y) ![img](https://i.mg/a.png)');
    expect(description).toBe('Title bold link');
  });
});
