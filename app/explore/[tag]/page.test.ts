import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ call: vi.fn() }));

vi.mock('@/lib/hive/hiveclient', () => ({
  default: { call: (...args: unknown[]) => mocks.call(...args) },
}));

vi.mock('@/components/explore/ExploreTagPage', () => ({
  default: function ExploreTagPage() {
    return null;
  },
}));

import { generateMetadata } from './page';

beforeEach(() => {
  mocks.call.mockReset();
});

describe('explore/[tag] generateMetadata', () => {
  it('builds unique tag metadata without calling bridge', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ tag: 'photography' }) });
    expect(meta.title).toBe('#photography');
    expect(meta.alternates?.canonical).toBe('/explore/photography');
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it('includes the community title for hive-xxxx tags', async () => {
    mocks.call.mockResolvedValue({ title: 'HiveGems' });
    const meta = await generateMetadata({ params: Promise.resolve({ tag: 'hive-178315' }) });
    expect(meta.title).toBe('HiveGems (hive-178315)');
    expect(mocks.call).toHaveBeenCalledWith('bridge', 'get_community', { name: 'hive-178315' });
  });
});
