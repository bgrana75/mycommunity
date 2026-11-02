import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
vi.mock('./hiveclient', () => ({ default: { call: (...a: unknown[]) => call(...a), database: { call: vi.fn() } } }));

async function load() {
  vi.resetModules();
  return (await import('./metadata-functions')).getProfileForMetadata;
}

beforeEach(() => call.mockReset());

describe('getProfileForMetadata cache', () => {
  it('serves a repeat lookup from memory', async () => {
    call.mockResolvedValue({ name: 'snapie' });
    const get = await load();
    await get('snapie');
    await get('snapie');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('shares one lookup between concurrent callers', async () => {
    call.mockResolvedValue({ name: 'snapie' });
    const get = await load();
    await Promise.all([get('snapie'), get('snapie')]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('serves the stale profile when the refresh finds nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    call.mockResolvedValueOnce({ name: 'snapie' });
    const get = await load();
    await get('snapie');
    vi.setSystemTime(Date.now() + 6 * 60_000);
    call.mockResolvedValue(null);
    expect(await get('snapie')).toEqual({ name: 'snapie' });
    expect(call).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('does not cache a miss', async () => {
    call.mockResolvedValueOnce(null).mockResolvedValueOnce({ name: 'snapie' });
    const get = await load();
    expect(await get('snapie')).toBeNull();
    expect(await get('snapie')).toEqual({ name: 'snapie' });
  });
});
