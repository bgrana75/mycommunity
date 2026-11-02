// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import ChatPage from './page';
import { OPEN_CHAT_EVENT } from '@/lib/chat/openChat';

// Guest /chat used to render nothing: the catch-all slug page returns null
// for any path that is not a profile, post, wallet, or notifications URL, so
// a logged-out visit showed the site nav and an empty main area. This page
// is the auth gate that replaces that blank shell.

const mocks = vi.hoisted(() => ({
  isLoggedIn: false,
  username: null as string | null,
  isLoading: false,
  openLoginModal: vi.fn(),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    isLoggedIn: mocks.isLoggedIn,
    username: mocks.username,
  }),
}));

vi.mock('@/contexts/SnapieAuthContext', () => ({
  useSnapieAuth: () => ({ isLoading: mocks.isLoading }),
}));

vi.mock('@/contexts/LoginModalContext', () => ({
  useLoginModal: () => ({ openLoginModal: mocks.openLoginModal }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    }),
  });
}

function renderPage() {
  return render(
    <ChakraProvider>
      <ChatPage />
    </ChakraProvider>,
  );
}

beforeEach(() => {
  mocks.isLoggedIn = false;
  mocks.username = null;
  mocks.isLoading = false;
  mocks.openLoginModal.mockReset();
});

afterEach(cleanup);

describe('guest /chat', () => {
  it('shows a sign-in gate instead of an empty main area', () => {
    const { container } = renderPage();

    expect(screen.getByRole('heading', { name: 'Sign in to chat' })).toBeTruthy();
    expect(screen.getByText(/Google, email, or your Hive wallet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create account' }).getAttribute('href')).toBe('/join');
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Chat' })).toBeNull();
  });

  it('opens the existing login modal from the gate', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(mocks.openLoginModal).toHaveBeenCalledTimes(1);
  });

  it('holds the gate while the session check is in flight', () => {
    mocks.isLoading = true;
    renderPage();

    expect(screen.getByRole('status').textContent).toMatch(/Checking session/);
    expect(screen.queryByRole('heading', { name: 'Sign in to chat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
  });

  it('does not open the chat panel for a logged-out visitor', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');
    renderPage();
    const opened = spy.mock.calls.some((call) => (call[0] as Event).type === OPEN_CHAT_EVENT);
    expect(opened).toBe(false);
    spy.mockRestore();
  });
});

describe('signed-in /chat', () => {
  it('opens the chat panel and does not show the guest gate', () => {
    mocks.isLoggedIn = true;
    mocks.username = 'alice';
    const spy = vi.spyOn(window, 'dispatchEvent');

    renderPage();

    expect(screen.queryByRole('heading', { name: 'Sign in to chat' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Log in' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeTruthy();
    expect(spy.mock.calls.some((call) => (call[0] as Event).type === OPEN_CHAT_EVENT)).toBe(true);

    spy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(spy.mock.calls.some((call) => (call[0] as Event).type === OPEN_CHAT_EVENT)).toBe(true);
    spy.mockRestore();
  });
});
