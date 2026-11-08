// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { Comment } from '@hiveio/dhive';
import Conversation from './Conversation';

// Regression test for issue #143 (Conversation exhaustive-deps): the
// refreshTrigger effect omitted `updateComments` from its deps. Because
// useComments derives updateComments from fetchAndUpdateComments (whose deps
// include the mutedTagsKey), the effect was missing the muted-tags change as
// a refetch signal — a muted tag added while the thread was open kept
// showing until the thread was closed and reopened.

const mocks = vi.hoisted(() => ({
  getPayoutValue: vi.fn(() => '0.000 HBD'),
  isSnapContainer: vi.fn(() => false),
  isWaveContainer: vi.fn(() => false),
}));

vi.mock('@/lib/utils/snapUtils', () => mocks);
vi.mock('@/lib/hive/client-functions', () => ({
  getPayoutValue: mocks.getPayoutValue,
}));

vi.mock('@/contexts/UserContext', () => ({
  useHiveUser: () => ({ hiveUser: { name: 'alice' } }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Snap renders a full post card; the behavior under test lives above it.
vi.mock('./Snap', () => ({ default: () => null }));

const mutedAccountsMock = vi.hoisted(() => ({
  getMutedList: vi.fn(async () => new Set<string>()),
}));
vi.mock('@/lib/hive/muted-accounts', () => ({ mutedAccountsManager: mutedAccountsMock }));

// let each test control what useComments sees, mirroring the hydration race
// documented in useComments.test.tsx.
let mockMutedTags: string[] = [];
vi.mock('@/hooks/useContentFilter', async () => {
  const { compileFilter } = await import('@snapie/content-filter');
  const tags = () => mockMutedTags;
  return {
    useContentFilter: () => ({ filter: compileFilter(tags().map(tag => ({ kind: 'tag' as const, tag }))), key: tags().join(',') }),
  };
});
vi.mock('@/lib/contentFilter/store', async () => {
  const { compileFilter } = await import('@snapie/content-filter');
  return {
    contentFilterStore: { getState: () => ({ filter: compileFilter((mockMutedTags).map(tag => ({ kind: 'tag' as const, tag }))) }) },
  };
});

const callMock = vi.fn();
vi.mock('@/lib/hive/hiveclient', () => ({
  default: { database: { call: (...args: unknown[]) => callMock(...args) } },
}));

function comment(permlink: string, tags: string[]): Comment {
  return {
    author: 'someone',
    permlink,
    created: new Date().toISOString(),
    json_metadata: JSON.stringify({ tags }),
    children: 0,
  } as unknown as Comment;
}

beforeEach(() => {
  mockMutedTags = [];
  callMock.mockReset();
  mutedAccountsMock.getMutedList.mockClear();
});

afterEach(cleanup);

describe('Conversation refetch on updateComments identity change', () => {
  it('refetches the thread when muted tags change while it is open', async () => {
    const topLevel = comment('top-permlink', ['test']);
    const { rerender } = render(
      <Conversation
        comment={topLevel}
        setConversation={vi.fn()}
        onOpen={vi.fn()}
        setReply={vi.fn()}
        refreshTrigger={0}
      />,
    );

    // Mount: pre-hydration fetch with empty mutedTags.
    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(1));

    // Settings hydrate: user muted #spam. useComments rebuilds
    // updateComments (mutedTagsKey changed) — Conversation must refire its
    // refreshTrigger effect on the new identity.
    mockMutedTags = ['spam'];
    rerender(
      <Conversation
        comment={topLevel}
        setConversation={vi.fn()}
        onOpen={vi.fn()}
        setReply={vi.fn()}
        refreshTrigger={0}
      />,
    );

    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(2));
  });

  it('still refetches on a refreshTrigger bump (unchanged behavior)', async () => {
    const topLevel = comment('top-permlink', ['test']);
    const { rerender } = render(
      <Conversation
        comment={topLevel}
        setConversation={vi.fn()}
        onOpen={vi.fn()}
        setReply={vi.fn()}
        refreshTrigger={0}
      />,
    );

    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(1));

    rerender(
      <Conversation
        comment={topLevel}
        setConversation={vi.fn()}
        onOpen={vi.fn()}
        setReply={vi.fn()}
        refreshTrigger={1}
      />,
    );

    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(2));
  });
});
