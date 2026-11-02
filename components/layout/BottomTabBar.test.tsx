// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BottomTabBar from './BottomTabBar';

const mocks = vi.hoisted(() => ({
  username: null as string | null,
  isLoggedIn: false,
  openLoginModal: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/blog',
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ username: mocks.username, isLoggedIn: mocks.isLoggedIn }),
}));
vi.mock('@/hooks/useUnclaimedRewards', () => ({ useUnclaimedRewards: () => false }));
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

const renderBar = () => render(<ChakraProvider><BottomTabBar /></ChakraProvider>);

beforeEach(() => {
  mocks.username = null;
  mocks.isLoggedIn = false;
  mocks.openLoginModal.mockReset();
  mocks.push.mockReset();
});
afterEach(cleanup);

describe('BottomTabBar', () => {
  it('names the compose button for assistive tech', () => {
    renderBar();
    expect(screen.getByRole('button', { name: 'Compose' })).toBeTruthy();
  });

  it('asks a guest to log in instead of doing nothing on Compose', () => {
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
    expect(mocks.openLoginModal).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('asks a guest to log in instead of linking to a wallet page', () => {
    renderBar();
    fireEvent.click(screen.getByRole('link', { name: /Wallet/ }));
    expect(mocks.openLoginModal).toHaveBeenCalledTimes(1);
  });

  it('lets a signed-in user compose and open their wallet', () => {
    mocks.isLoggedIn = true;
    mocks.username = 'alice';
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Compose' }));
    expect(mocks.push).toHaveBeenCalledWith('/compose');
    const wallet = screen.getByRole('link', { name: /Wallet/ });
    expect(wallet.getAttribute('href')).toBe('/@alice/wallet');
    wallet.addEventListener('click', (e) => e.preventDefault()); // jsdom cannot navigate
    fireEvent.click(wallet);
    expect(mocks.openLoginModal).not.toHaveBeenCalled();
  });
});
