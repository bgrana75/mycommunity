// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import type { Message } from '@/lib/chat/ChatService';
import { CHAT_LIST_INDEX_ORIGIN } from '@/lib/chat/messageScroll';

// Regression for issue #77. A long thread used to open at the top: Virtuoso
// ignores scrollToIndex on its first mount, startReached then prepends the
// previous page, and atBottom(false) cancelled the pin. Short threads have no
// older page, which is why that path did not reproduce.

const mocks = vi.hoisted(() => ({
  getChannels: vi.fn(),
  getConversations: vi.fn(),
  getPreferences: vi.fn(),
  getMessages: vi.fn(),
  getDmMessages: vi.fn(),
  markRead: vi.fn(),
  getTyping: vi.fn(),
  joinChannel: vi.fn(),
  setTyping: vi.fn(),
  isAuthenticated: vi.fn(() => true),
  getTokenUsername: vi.fn(() => 'alice'),
}));

// Scroll tests drive a fake chatService. The rejected-session test flips this
// so ChatPanel hits the real service, whose post() clears hive-chat-token.
const serviceMode = vi.hoisted(() => ({ real: false }));

const virtuoso = vi.hoisted(() => ({
  props: null as null | Record<string, any>,
}));

vi.mock('react-virtuoso', () => {
  const React = require('react');
  const Virtuoso = React.forwardRef((props: Record<string, any>, ref: React.Ref<{ scrollToIndex: () => void }>) => {
    virtuoso.props = props;
    React.useImperativeHandle(ref, () => ({ scrollToIndex: vi.fn() }));
    return React.createElement('div', { 'data-testid': 'virtuoso-list' });
  });
  Virtuoso.displayName = 'Virtuoso';
  return { Virtuoso };
});

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ username: 'alice', isLoggedIn: true, isSnapie: false, logout: vi.fn() }),
}));

vi.mock('@/hooks/useMoodBadges', () => ({
  useMoodBadges: () => ({ getEquippedBadge: () => null }),
}));

vi.mock('@/lib/chat/fcmClient', () => ({
  getFCMToken: vi.fn(async () => null),
  onForegroundMessage: vi.fn(() => () => {}),
}));

vi.mock('@/lib/hive/aioha', () => ({
  signMessageWithAioha: vi.fn(),
  transferEncryptedMemoWithAioha: vi.fn(),
}));

vi.mock('@/components/homepage/GiphySelector', () => ({ default: () => null }));

vi.mock('@/lib/chat/ChatService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/chat/ChatService')>();
  const real = actual.chatService;
  const fake = {
    isAuthenticated: () => mocks.isAuthenticated(),
    getTokenUsername: () => mocks.getTokenUsername(),
    getChannels: (...args: unknown[]) => mocks.getChannels(...args),
    getConversations: (...args: unknown[]) => mocks.getConversations(...args),
    getPreferences: (...args: unknown[]) => mocks.getPreferences(...args),
    getMessages: (...args: unknown[]) => mocks.getMessages(...args),
    getDmMessages: (...args: unknown[]) => mocks.getDmMessages(...args),
    markRead: (...args: unknown[]) => mocks.markRead(...args),
    getTyping: (...args: unknown[]) => mocks.getTyping(...args),
    joinChannel: (...args: unknown[]) => mocks.joinChannel(...args),
    setTyping: (...args: unknown[]) => mocks.setTyping(...args),
    logout: vi.fn(),
  };
  const chatService = new Proxy(fake, {
    get(target, prop, _receiver) {
      const source = serviceMode.real ? real : target;
      const value = Reflect.get(source, prop, source);
      return typeof value === 'function' ? value.bind(source) : value;
    },
  });
  return { ...actual, chatService };
});

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: () => {} });
}
window.matchMedia = (query: string) => {
  const min = /min-width:\s*([\d.]+)(px|em)/.exec(query);
  const toPx = (raw: string, unit: string) => (unit === 'em' ? parseFloat(raw) * 16 : parseFloat(raw));
  const width = 1280;
  return {
    matches: min ? width >= toPx(min[1], min[2]) : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  };
};

function message(id: string, sender: string, content: string): Message {
  return { _id: id, sender, content, createdAt: '2026-06-01T00:00:00.000Z' };
}

const generalThread = Array.from({ length: 50 }, (_, index) => (
  message(`g${String(index).padStart(2, '0')}`, index % 2 ? 'bob' : 'carol', `general ${index}`)
));
const randomThread = [
  message('r0', 'dave', 'older random'),
  message('r1', 'dave', 'latest random'),
];
const dmThread = [
  message('d0', 'bob', 'hey'),
  message('d1', 'alice', 'hi back'),
];

function messageCalls() {
  return mocks.getMessages.mock.calls.map(call => ({
    id: call[0] as string,
    opts: (call[1] ?? {}) as { before?: string; after?: string },
  }));
}

beforeEach(() => {
  serviceMode.real = false;
  virtuoso.props = null;
  mocks.isAuthenticated.mockReturnValue(true);
  mocks.getTokenUsername.mockReturnValue('alice');
  mocks.getChannels.mockResolvedValue([
    { _id: 'general', name: 'general', type: 'channel', isPublic: true, memberCount: 2 },
    { _id: 'random', name: 'random', type: 'channel', isPublic: true, memberCount: 2 },
  ]);
  mocks.getConversations.mockResolvedValue([
    { _id: 'general', name: 'general', type: 'channel', isPublic: true, lastMessage: message('g49', 'carol', 'general-preview') },
    { _id: 'random', name: 'random', type: 'channel', isPublic: true, lastMessage: message('r1', 'dave', 'random-preview') },
    { _id: 'dm-bob', name: '@bob', type: 'dm', isPublic: false, peer: 'bob', lastMessage: message('d1', 'alice', 'dm-preview') },
  ]);
  mocks.getPreferences.mockResolvedValue({ mutedUsers: [], blockedUsers: [] });
  mocks.markRead.mockResolvedValue({ total: 0, byConversation: {} });
  mocks.getTyping.mockResolvedValue({ users: [], ttlMs: 3000 });
  mocks.joinChannel.mockResolvedValue(undefined);
  mocks.setTyping.mockResolvedValue(undefined);
  mocks.getMessages.mockImplementation(async (id: string, opts: { before?: string; after?: string } = {}) => {
    if (opts.after) return [];
    if (opts.before) return [message('a00', 'erin', 'older page')];
    if (id === 'general') return generalThread;
    if (id === 'random') return randomThread;
    return [];
  });
  mocks.getDmMessages.mockImplementation(async (_id: string, opts: { before?: string; after?: string } = {}) => {
    if (opts.after) return { messages: [], status: null };
    if (opts.before) return { messages: [message('d-older', 'bob', 'way earlier')], status: null };
    return {
      messages: dmThread,
      status: {
        meSeenAt: '2026-06-01T00:00:00.000Z',
        peerSeenAt: '2026-06-01T00:00:01.000Z',
        peerLastSeenAt: null,
        peerOnline: false,
      },
    };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function openConversation(preview: string) {
  const back = screen.queryByRole('button', { name: 'Back to conversations' });
  if (back) fireEvent.click(back);
  fireEvent.click(screen.getByText(preview, { exact: false }));
  await waitFor(() => expect(screen.getByTestId('virtuoso-list')).toBeTruthy());
}

async function openPanel() {
  const { default: ChatPanel } = await import('./ChatPanel');
  render(
    <ChakraProvider>
      <ChatPanel isOpen onClose={vi.fn()} />
    </ChakraProvider>,
  );
  await waitFor(() => expect(screen.getByText('general-preview', { exact: false })).toBeTruthy());
  await openConversation('general-preview');
}

describe('ChatPanel scrolls to the newest messages when the conversation changes', () => {
  it('opens a long thread at the bottom and ignores the mount-time startReached', async () => {
    await openPanel();

    expect(virtuoso.props).toMatchObject({
      alignToBottom: true,
      followOutput: 'auto',
      firstItemIndex: CHAT_LIST_INDEX_ORIGIN,
      initialTopMostItemIndex: { index: 'LAST', align: 'end' },
    });
    expect(virtuoso.props?.data).toHaveLength(50);
    expect(virtuoso.props?.data[49]._id).toBe('g49');

    virtuoso.props?.startReached();
    virtuoso.props?.atBottomStateChange(false);
    await Promise.resolve();

    expect(messageCalls().some(call => call.opts.before)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Jump to current messages' })).toBeNull();
    expect(virtuoso.props?.followOutput).toBe('auto');
  });

  it('keeps the viewport put once the user scrolls up, including after a channel switch', async () => {
    await openPanel();

    virtuoso.props?.atBottomStateChange(true);
    virtuoso.props?.atBottomStateChange(false);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jump to current messages' })).toBeTruthy();
    });
    expect(virtuoso.props?.followOutput).toBe(false);

    const beforeCount = messageCalls().filter(call => call.opts.before).length;
    virtuoso.props?.startReached();
    await waitFor(() => {
      expect(messageCalls().filter(call => call.opts.before).length).toBe(beforeCount + 1);
    });
    expect(messageCalls().filter(call => call.opts.before).at(-1)).toMatchObject({
      id: 'general',
      opts: { before: 'g00' },
    });
    await waitFor(() => expect(virtuoso.props?.firstItemIndex).toBe(CHAT_LIST_INDEX_ORIGIN - 1));
    expect(virtuoso.props?.data?.[0]?._id).toBe('a00');
    expect(virtuoso.props?.followOutput).toBe(false);

    await openConversation('random-preview');
    await waitFor(() => expect(virtuoso.props?.data?.[1]?._id).toBe('r1'));
    expect(virtuoso.props).toMatchObject({
      followOutput: 'auto',
      firstItemIndex: CHAT_LIST_INDEX_ORIGIN,
      initialTopMostItemIndex: { index: 'LAST', align: 'end' },
    });
    expect(screen.queryByRole('button', { name: 'Jump to current messages' })).toBeNull();

    virtuoso.props?.startReached();
    virtuoso.props?.atBottomStateChange(false);
    await Promise.resolve();
    expect(messageCalls().some(call => call.id === 'random' && call.opts.before)).toBe(false);
  });

  it('opens a DM at the bottom and does not apply a stale channel response', async () => {
    let releaseGeneral: (messages: Message[]) => void = () => {};
    mocks.getMessages.mockImplementation((id: string, opts: { before?: string; after?: string } = {}) => {
      if (opts.after) return Promise.resolve([]);
      if (id === 'general') {
        return new Promise<Message[]>(resolve => {
          releaseGeneral = resolve;
        });
      }
      if (id === 'random') return Promise.resolve(randomThread);
      return Promise.resolve([]);
    });

    const { default: ChatPanel } = await import('./ChatPanel');
    render(
      <ChakraProvider>
        <ChatPanel isOpen onClose={vi.fn()} />
      </ChakraProvider>,
    );
    await waitFor(() => expect(screen.getByText('dm-preview', { exact: false })).toBeTruthy());
    await openConversation('dm-preview');

    await waitFor(() => expect(virtuoso.props?.data?.[1]?._id).toBe('d1'));
    expect(virtuoso.props).toMatchObject({
      alignToBottom: true,
      followOutput: 'auto',
      initialTopMostItemIndex: { index: 'LAST', align: 'end' },
    });
    expect(screen.getByText('Seen')).toBeTruthy();

    releaseGeneral(generalThread);
    await Promise.resolve();
    await Promise.resolve();
    expect(virtuoso.props?.data?.map((row: Message) => row._id)).toEqual(['d0', 'd1']);
  });
});

describe('ChatPanel day separators', () => {
  function wallClock(dayOffset: number, hour: number, minute: number): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute, 0, 0);
  }

  function renderRows() {
    const rows = (virtuoso.props?.data ?? []) as Message[];
    const items = rows.map((msg, index) => virtuoso.props?.itemContent(CHAT_LIST_INDEX_ORIGIN + index, msg));
    return render(<ChakraProvider>{items}</ChakraProvider>);
  }

  it('inserts Today and Yesterday separators in channels and DMs without dropping timestamps', async () => {
    const yesterday = wallClock(-1, 18, 5);
    const todayEarly = wallClock(0, 9, 15);
    const todayLate = wallClock(0, 11, 45);
    const timeLabel = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    mocks.getMessages.mockImplementation(async (id: string, opts: { before?: string; after?: string } = {}) => {
      if (opts.after || opts.before) return [];
      if (id !== 'general') return [];
      return [
        { ...message('g0', 'bob', 'see you tomorrow'), createdAt: yesterday.toISOString() },
        { ...message('g1', 'carol', 'good morning'), createdAt: todayEarly.toISOString() },
        { ...message('g2', 'bob', 'still today'), createdAt: todayLate.toISOString() },
      ];
    });
    mocks.getDmMessages.mockImplementation(async (_id: string, opts: { before?: string; after?: string } = {}) => {
      if (opts.after || opts.before) return { messages: [], status: null };
      return {
        messages: [
          { ...message('d0', 'bob', 'dm yesterday'), createdAt: yesterday.toISOString() },
          { ...message('d1', 'alice', 'dm today'), createdAt: todayEarly.toISOString() },
        ],
        status: {
          meSeenAt: todayEarly.toISOString(),
          peerSeenAt: todayEarly.toISOString(),
          peerLastSeenAt: null,
          peerOnline: false,
        },
      };
    });

    await openPanel();
    const channel = renderRows();
    expect(channel.getAllByRole('separator', { name: 'Yesterday' })).toHaveLength(1);
    expect(channel.getAllByRole('separator', { name: 'Today' })).toHaveLength(1);
    expect(channel.getByText('see you tomorrow')).toBeTruthy();
    expect(channel.getByText('good morning')).toBeTruthy();
    expect(channel.getByText('still today')).toBeTruthy();
    expect(channel.getByText(timeLabel(yesterday))).toBeTruthy();
    expect(channel.getByText(timeLabel(todayEarly))).toBeTruthy();
    expect(channel.getByText(timeLabel(todayLate))).toBeTruthy();
    channel.unmount();

    await openConversation('dm-preview');
    const dm = renderRows();
    expect(dm.getAllByRole('separator', { name: 'Yesterday' })).toHaveLength(1);
    expect(dm.getAllByRole('separator', { name: 'Today' })).toHaveLength(1);
    expect(dm.getByText('dm yesterday')).toBeTruthy();
    expect(dm.getByText('dm today')).toBeTruthy();
    expect(dm.getByText(timeLabel(yesterday))).toBeTruthy();
    expect(dm.getByText(timeLabel(todayEarly))).toBeTruthy();
  });
});

const TOKEN_KEY = 'hive-chat-token';

function unsignedJwt(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'alice', exp: expSeconds }));
  return `${header}.${payload}.sig`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ChatPanel account switch', () => {
  it('keeps the composer closed while the stored token still belongs to someone else', async () => {
    mocks.isAuthenticated.mockReturnValue(true);
    mocks.getTokenUsername.mockReturnValue('previous-account');

    const { chatService } = await import('@/lib/chat/ChatService');
    const { default: ChatPanel } = await import('./ChatPanel');
    render(
      <ChakraProvider>
        <ChatPanel isOpen onClose={vi.fn()} />
      </ChakraProvider>,
    );

    fireEvent.click(await screen.findByText('#general'));

    expect(await screen.findByText('Connect your Hive account to chat')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Message…')).toBeNull();
    // The account-switch effect calls logout(), but the gate cannot wait for
    // that. The previous account's session is still usable on this render.
    expect(chatService.isAuthenticated()).toBe(true);
    expect(chatService.getTokenUsername()).toBe('previous-account');
  });
});

describe('ChatPanel rejected session', () => {
  beforeEach(() => {
    serviceMode.real = true;
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method || 'GET').toUpperCase();

        // The send path. ChatService only drops the stored token for a
        // non-GET 401, then post() throws CHAT_UNAUTHORIZED. Other posts
        // (read receipts, typing) must keep succeeding or the token would
        // be gone before the user ever sends.
        if (method === 'POST' && url.includes('/messages')) {
          return jsonResponse({ error: 'unauthorized' }, 401);
        }

        if (method === 'GET' && url.includes('/channels') && !url.includes('/messages')) {
          return jsonResponse({
            channels: [{
              _id: 'general',
              name: 'general',
              type: 'channel',
              conversationKind: 'channel',
              isPublic: true,
              owner: 'snapie',
              members: [],
              memberCount: 1,
            }],
          });
        }

        if (url.includes('/conversations')) return jsonResponse({ conversations: [] });
        if (url.includes('/messages')) return jsonResponse({ messages: [] });
        if (url.includes('/preferences')) return jsonResponse({ mutedUsers: [], blockedUsers: [] });
        if (url.includes('/typing')) return jsonResponse({ users: [], ttlMs: 0 });
        if (url.includes('/read')) return jsonResponse({ unread: 0, conversations: {} });
        return jsonResponse({});
      }),
    );
  });

  afterEach(() => {
    serviceMode.real = false;
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows the auth gate and drops the stored token when sending is rejected', async () => {
    const { chatService } = await import('@/lib/chat/ChatService');
    const token = unsignedJwt(Math.floor(Date.now() / 1000) + 60 * 60);
    localStorage.setItem(TOKEN_KEY, token);
    expect(chatService.isAuthenticated()).toBe(true);

    const { default: ChatPanel } = await import('./ChatPanel');
    render(
      <ChakraProvider>
        <ChatPanel isOpen onClose={vi.fn()} />
      </ChakraProvider>,
    );

    // The panel opens on the conversation list at the base breakpoint.
    // Opening the channel is what reveals the composer.
    fireEvent.click(await screen.findByText('#general'));
    const composer = await screen.findByPlaceholderText('Message…');
    expect(screen.queryByText('Connect your Hive account to chat')).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBe(token);

    fireEvent.change(composer, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('Connect your Hive account to chat')).toBeTruthy();
    });
    expect(screen.queryByPlaceholderText('Message…')).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(chatService.isAuthenticated()).toBe(false);

    const fetchMock = vi.mocked(fetch);
    const rejectedSend = fetchMock.mock.calls.find(([input, init]) => {
      const url = String(input);
      const method = ((init as RequestInit | undefined)?.method || 'GET').toUpperCase();
      return method === 'POST' && url.includes('/messages');
    });
    expect(rejectedSend).toBeTruthy();
  });
});

describe('ChatPanel conversation list loading (#267)', () => {
  const never = () => new Promise<never>(() => {});

  async function mountPanel() {
    const { default: ChatPanel } = await import('./ChatPanel');
    return render(
      <ChakraProvider>
        <ChatPanel isOpen onClose={vi.fn()} />
      </ChakraProvider>,
    );
  }

  it('shows a spinner, not "No conversations yet", while the lists are loading', async () => {
    mocks.getChannels.mockImplementation(never);
    mocks.getConversations.mockImplementation(never);
    await mountPanel();

    expect(await screen.findByLabelText('Loading conversations')).toBeTruthy();
    expect(screen.queryByText('No conversations yet')).toBeNull();
  });

  it('shows public channels even when the authed conversations call never resolves', async () => {
    mocks.getConversations.mockImplementation(never);
    await mountPanel();

    expect(await screen.findByText('#general')).toBeTruthy();
    expect(screen.queryByText('No conversations yet')).toBeNull();
  });

  it('keeps public channels, explains the failure, and retries when conversations fail', async () => {
    mocks.getConversations.mockRejectedValueOnce(new Error('HTTP 500'));
    await mountPanel();

    expect(await screen.findByText('#general')).toBeTruthy();
    expect(await screen.findByText('Could not load your DMs and groups.')).toBeTruthy();
    expect(screen.queryByText('No conversations yet')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('dm-preview', { exact: false })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Could not load your DMs and groups.')).toBeNull());
  });

  it('shows an error state instead of an empty one when every request fails', async () => {
    mocks.getChannels.mockRejectedValue(new Error('network'));
    mocks.getConversations.mockRejectedValue(new Error('network'));
    await mountPanel();

    expect(await screen.findByText('Conversations unavailable')).toBeTruthy();
    expect(screen.getByText('Could not load conversations.')).toBeTruthy();
    expect(screen.queryByText('No conversations yet')).toBeNull();
  });

  it('says "No conversations yet" only after a load that really returned nothing', async () => {
    mocks.getChannels.mockResolvedValue([]);
    mocks.getConversations.mockResolvedValue([]);
    await mountPanel();

    expect(await screen.findByText('No conversations yet')).toBeTruthy();
  });

  it('keeps DMs already on screen when reopening and conversations fail', async () => {
    const { default: ChatPanel } = await import('./ChatPanel');
    const onClose = vi.fn();
    const view = render(
      <ChakraProvider>
        <ChatPanel isOpen onClose={onClose} />
      </ChakraProvider>,
    );
    expect(await screen.findByText('dm-preview', { exact: false })).toBeTruthy();

    view.rerender(
      <ChakraProvider>
        <ChatPanel isOpen={false} onClose={onClose} />
      </ChakraProvider>,
    );

    let resolveChannels: (channels: unknown) => void = () => {};
    mocks.getChannels.mockImplementation(
      () => new Promise(resolve => { resolveChannels = resolve; }),
    );
    mocks.getConversations.mockRejectedValue(new Error('HTTP 500'));

    view.rerender(
      <ChakraProvider>
        <ChatPanel isOpen onClose={onClose} />
      </ChakraProvider>,
    );

    expect(await screen.findByText('dm-preview', { exact: false })).toBeTruthy();

    resolveChannels([
      { _id: 'general', name: 'general', type: 'channel', isPublic: true, memberCount: 2 },
    ]);

    expect(await screen.findByText('Could not load your DMs and groups.')).toBeTruthy();
    expect(screen.getByText('#general')).toBeTruthy();
    expect(screen.getByText('dm-preview', { exact: false })).toBeTruthy();
  });
});
