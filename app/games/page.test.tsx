// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GamesPage from './page';

const mocks = vi.hoisted(() => ({
  isLoggedIn: false,
  username: null as string | null,
  points: null as { balance: number } | null,
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ isLoggedIn: mocks.isLoggedIn, username: mocks.username }),
}));
vi.mock('@/hooks/usePointsSummary', () => ({ usePointsSummary: () => mocks.points }));
vi.mock('@/contexts/LoginModalContext', () => ({ useLoginModal: () => ({ openLoginModal: vi.fn() }) }));
vi.mock('@/lib/points/config', () => ({ GAMES_FEATURE_FLAG: true }));
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

const renderPage = () => render(<ChakraProvider><GamesPage /></ChakraProvider>);

beforeEach(() => {
  mocks.isLoggedIn = false;
  mocks.username = null;
  mocks.points = null;
});
afterEach(cleanup);

describe('/games hub points balance', () => {
  it('shows the Snapie Points balance to a signed-in user', () => {
    mocks.isLoggedIn = true;
    mocks.username = 'alice';
    mocks.points = { balance: 42 };
    renderPage();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText(/Snapie Points$/)).toBeTruthy();
  });

  it('shows a dash while the balance loads', () => {
    mocks.isLoggedIn = true;
    mocks.username = 'alice';
    renderPage();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('shows no balance to a guest', () => {
    renderPage();
    expect(screen.queryByText(/Balance:/)).toBeNull();
  });
});
