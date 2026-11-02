// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import SnapieInfoWarPage from './page';

// Server HTML for this route used to include a next/dynamic ssr:false bailout
// (a window check during render) and a crypto.randomUUID() useState
// initializer. Both can disagree with the client tree. The page now renders
// the same chrome on the server and the client, and mounts the shell only
// after a session id is assigned in an effect.

const mocks = vi.hoisted(() => ({
  isLoggedIn: false,
  username: null as string | null,
  openLoginModal: vi.fn(),
  saveGameScore: vi.fn(),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    isLoggedIn: mocks.isLoggedIn,
    username: mocks.username,
  }),
}));

vi.mock('@/contexts/LoginModalContext', () => ({
  useLoginModal: () => ({ openLoginModal: mocks.openLoginModal }),
}));

vi.mock('@/hooks/usePointsSummary', () => ({
  usePointsSummary: () => null,
}));

vi.mock('@/lib/points/config', () => ({
  GAMES_FEATURE_FLAG: true,
}));

vi.mock('@/lib/games/scoreClient', () => ({
  saveGameScore: (...args: unknown[]) => mocks.saveGameScore(...args),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock('@/components/games/snapie-info-war/SnapieInfoWar', () => ({
  SnapieInfoWar: (props: {
    sessionId: string;
    onEvent?: (event: { type: string }) => void;
    onResult?: (result: {
      sessionId: string;
      score: number;
      stage: number;
      stagesCleared: number;
      won: boolean;
      durationMs: number;
      endedAt: number;
    }) => void;
    resultSlot?: ReactNode;
  }) => (
    <div data-testid="info-war-shell" data-session={props.sessionId}>
      <button type="button" onClick={() => props.onEvent?.({ type: 'game-over' })}>
        emit-game-over
      </button>
      <button
        type="button"
        onClick={() => props.onResult?.({
          sessionId: props.sessionId,
          score: 10,
          stage: 1,
          stagesCleared: 0,
          won: false,
          durationMs: 1000,
          endedAt: 1,
        })}
      >
        emit-result
      </button>
      {props.resultSlot}
    </div>
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

function tree() {
  return (
    <ChakraProvider>
      <SnapieInfoWarPage />
    </ChakraProvider>
  );
}

function renderPage() {
  return render(tree());
}

function structuralHydrationErrors(errors: string[]) {
  return errors.filter((entry) => /Hydration failed|Minified React error #418|#418/.test(entry));
}

async function hydrateFromServer() {
  const html = renderToString(tree());
  const container = document.createElement('div');
  document.body.appendChild(container);
  container.innerHTML = html;
  const errors: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.map((arg) => String(arg)).join(' '));
  };
  let root: Root | undefined;
  try {
    await act(async () => {
      root = hydrateRoot(container, tree());
    });
  } finally {
    console.error = orig;
  }
  return { html, container, root: root!, errors };
}

beforeEach(() => {
  mocks.isLoggedIn = false;
  mocks.username = null;
  mocks.openLoginModal.mockReset();
  mocks.saveGameScore.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('guest /games/snapie-info-war', () => {
  it('hydrates the login gate without a structural mismatch', async () => {
    const { html, container, root, errors } = await hydrateFromServer();

    expect(html).toContain('Please log in to play');
    expect(html).not.toContain('Back to Games');
    expect(html).not.toContain('info-war-shell');
    expect(structuralHydrationErrors(errors)).toEqual([]);
    expect(container.textContent).toContain('Please log in to play');
    expect(container.querySelector('[data-testid="info-war-shell"]')).toBeNull();
    root.unmount();
  });

  it('opens the login modal from the gate', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(mocks.openLoginModal).toHaveBeenCalledTimes(1);
  });
});

describe('signed-in /games/snapie-info-war', () => {
  beforeEach(() => {
    mocks.isLoggedIn = true;
    mocks.username = 'alice';
  });

  it('hydrates the game chrome, then mounts the shell once a session id exists', async () => {
    const { html, container, root, errors } = await hydrateFromServer();

    expect(html).toContain('Back to Games');
    expect(html).toContain('Snapie: Information War');
    expect(html).not.toContain('info-war-shell');
    expect(html).not.toContain('<canvas');
    expect(structuralHydrationErrors(errors)).toEqual([]);

    const shell = container.querySelector('[data-testid="info-war-shell"]');
    expect(shell).toBeTruthy();
    expect(shell?.getAttribute('data-session')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    root.unmount();
  });

  it('rotates the session id after a finished run and can save the score', async () => {
    mocks.saveGameScore.mockResolvedValue({ status: 'awarded', pointsAwarded: 12, balance: 40 });
    renderPage();

    const shell = await screen.findByTestId('info-war-shell');
    const firstSession = shell.getAttribute('data-session');
    fireEvent.click(screen.getByRole('button', { name: 'emit-game-over' }));
    expect(screen.getByTestId('info-war-shell').getAttribute('data-session')).not.toBe(firstSession);

    fireEvent.click(screen.getByRole('button', { name: 'emit-result' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Score' }));

    expect(await screen.findByText(/Saved — \+12 Snapie Points/)).toBeTruthy();
    expect(mocks.saveGameScore).toHaveBeenCalledWith(
      'alice',
      'snapie-info-war',
      expect.objectContaining({ score: 10, sessionId: expect.any(String) }),
    );
  });
});
