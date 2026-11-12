// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import LayoutContent from './LayoutContent';
import { OPEN_CHAT_EVENT } from '@/lib/chat/openChat';

// The guest gate lives on the /chat page. This checks the shell still shows
// that page, and that a signed-in visit (which dispatches OPEN_CHAT_EVENT)
// opens the existing panel instead of leaving the main column as the only UI.

const nav = vi.hoisted(() => ({
  pathname: '/chat',
  back: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}));

const phone = vi.hoisted(() => ({ matches: false }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ back: nav.back, replace: nav.replace, push: nav.push }),
}));

vi.mock('@/components/layout/Sidebar', () => ({ default: () => <nav>Site nav</nav> }));
vi.mock('@/components/layout/MobileHeader', () => ({ default: () => null }));
vi.mock('@/components/layout/BottomTabBar', () => ({ default: () => null }));
vi.mock('@/components/layout/MeSheet', () => ({ default: () => null }));
vi.mock('@/components/chat/ChatPanel', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    isOpen ? (
      <div>
        <span>Chat panel</span>
        <button type="button" onClick={onClose}>Close chat</button>
      </div>
    ) : null
  ),
}));
vi.mock('@/components/hangouts/HangoutModal', () => ({ default: () => null }));
vi.mock('@/components/auth/EmancipationBanner', () => ({ default: () => null }));
vi.mock('@/components/auth/NeedsWalletHandler', () => ({ default: () => null }));
vi.mock('@/components/onboarding/InterestPicker', () => ({ default: () => null }));
vi.mock('@/components/whatsnew/WhatsNewModal', () => ({ default: () => null }));
vi.mock('@/components/points/PointsToaster', () => ({ default: () => null }));
vi.mock('@/components/debug/DebugConsole', () => ({ default: () => null }));

vi.mock('@/lib/chat/ChatService', () => ({
  chatService: { getUnreadCount: vi.fn(async () => 0) },
}));

vi.mock('@/contexts/HangoutContext', () => ({
  useHangout: () => ({ activeRoom: null, closeRoom: vi.fn() }),
}));

vi.mock('@/hooks/useUserSettings', () => ({
  useUserSettings: () => ({ settings: { colorMode: 'dark' } }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ username: null }),
}));

vi.mock('@/hooks/useShowInterestPicker', () => ({
  useShowInterestPicker: () => ({ shouldShow: false, dismiss: vi.fn() }),
}));

vi.mock('@/lib/points/config', () => ({
  isPointsEnabledFor: () => false,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: query.includes('max-width: 479px')
      ? phone.matches
      : query.includes('30em')
        ? !phone.matches
        : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  }),
});

function renderShell(child: string) {
  return render(
    <ChakraProvider>
      <LayoutContent>
        <h1>{child}</h1>
      </LayoutContent>
    </ChakraProvider>,
  );
}

beforeEach(() => {
  nav.pathname = '/chat';
  nav.back.mockReset();
  nav.replace.mockReset();
  nav.push.mockReset();
  phone.matches = false;
  window.history.replaceState({}, '');
});

afterEach(cleanup);

describe('chat shell', () => {
  it('keeps the page content visible for a guest and opens the panel only when asked', async () => {
    render(
      <ChakraProvider>
        <LayoutContent>
          <h1>Sign in to chat</h1>
        </LayoutContent>
      </ChakraProvider>,
    );

    expect(await screen.findByText('Site nav')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sign in to chat' })).toBeTruthy();
    expect(screen.queryByText('Chat panel')).toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
    });

    expect(await screen.findByText('Chat panel')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Sign in to chat' })).toBeTruthy();
  });

  it('closes a phone /chat visit back to the previous page', async () => {
    phone.matches = true;
    nav.pathname = '/games';
    const view = renderShell('Games');

    nav.pathname = '/chat';
    view.rerender(
      <ChakraProvider>
        <LayoutContent>
          <h1>Chat</h1>
        </LayoutContent>
      </ChakraProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Close chat' }));

    expect(screen.queryByText('Chat panel')).toBeNull();
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('closes a direct phone /chat visit to home', async () => {
    phone.matches = true;
    nav.pathname = '/chat';
    renderShell('Chat');

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));

    expect(screen.queryByText('Chat panel')).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith('/');
    expect(nav.back).not.toHaveBeenCalled();
  });

  it('shows the Hive footer on normal pages and hides it on shorts', () => {
    nav.pathname = '/';
    const view = render(
      <ChakraProvider>
        <LayoutContent footer={<a href="https://hive.io">Powered by Hive</a>}>
          <h1>Home</h1>
        </LayoutContent>
      </ChakraProvider>,
    );
    expect(screen.getByRole('link', { name: 'Powered by Hive' })).toBeTruthy();

    nav.pathname = '/shorts';
    view.rerender(
      <ChakraProvider>
        <LayoutContent footer={<a href="https://hive.io">Powered by Hive</a>}>
          <h1>Shorts</h1>
        </LayoutContent>
      </ChakraProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Powered by Hive' })).toBeNull();
  });

  it('sends Close home when browser back returns to a direct /chat visit', async () => {
    phone.matches = true;
    nav.pathname = '/chat';
    window.history.replaceState({}, '', '/chat');
    const view = renderShell('Chat');

    window.history.pushState({}, '', '/games');
    nav.pathname = '/games';
    view.rerender(
      <ChakraProvider>
        <LayoutContent>
          <h1>Games</h1>
        </LayoutContent>
      </ChakraProvider>,
    );

    await act(async () => {
      window.history.back();
    });
    nav.pathname = '/chat';
    view.rerender(
      <ChakraProvider>
        <LayoutContent>
          <h1>Chat</h1>
        </LayoutContent>
      </ChakraProvider>,
    );

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Close chat' }));

    expect(nav.replace).toHaveBeenCalledWith('/');
    expect(nav.back).not.toHaveBeenCalled();
  });
});
