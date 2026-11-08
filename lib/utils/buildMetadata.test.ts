import { describe, expect, it } from 'vitest';
import { buildPostMetadata, buildProfileMetadata, buildExploreTagMetadata } from './buildMetadata';

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

  it('sets a self-canonical for the post URL', () => {
    expect(post('hi').alternates?.canonical).toBe('/@alice/p');
  });
});

describe('buildProfileMetadata', () => {
  it('sets a self-canonical for the profile URL', () => {
    const meta = buildProfileMetadata({ name: 'alice', about: 'Hello' });
    expect(meta.alternates?.canonical).toBe('/@alice');
    expect(meta.title).toBe('@alice');
  });
});

describe('buildExploreTagMetadata', () => {
  it('titles a plain tag with a unique description and explore canonical', () => {
    const meta = buildExploreTagMetadata('photography');
    expect(meta.title).toBe('#photography');
    expect(meta.description).toContain('#photography');
    expect(meta.alternates?.canonical).toBe('/explore/photography');
  });

  it('titles a community with its display name when known', () => {
    const meta = buildExploreTagMetadata('hive-178315', 'HiveGems');
    expect(meta.title).toBe('HiveGems (hive-178315)');
    expect(meta.description).toContain('HiveGems');
    expect(meta.alternates?.canonical).toBe('/explore/hive-178315');
  });
});
