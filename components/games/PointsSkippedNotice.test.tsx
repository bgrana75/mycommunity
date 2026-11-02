// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSignDecline, isSignDeclined, rememberSignDecline } from '@/lib/hive/walletSign';
import { PointsSkippedNotice } from './PointsSkippedNotice';

const mocks = vi.hoisted(() => ({ ensureSessionToken: vi.fn() }));

vi.mock('@/lib/points/client', () => ({
  ensureSessionToken: (...args: unknown[]) => mocks.ensureSessionToken(...args),
}));

const renderNotice = (username: string | null) =>
  render(
    <ChakraProvider>
      <PointsSkippedNotice username={username} />
    </ChakraProvider>,
  );

beforeEach(() => {
  clearSignDecline();
  mocks.ensureSessionToken.mockReset();
});
afterEach(cleanup);

describe('PointsSkippedNotice', () => {
  it('renders nothing when the signature was not declined', () => {
    renderNotice('alice');
    expect(screen.queryByText(/skipped the signature/)).toBeNull();
  });

  it('explains the skipped signature and lets the user enable points', async () => {
    rememberSignDecline();
    mocks.ensureSessionToken.mockResolvedValue('token');
    renderNotice('alice');
    expect(await screen.findByText(/skipped the signature/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Enable Snapie Points' }));
    await waitFor(() => expect(screen.queryByText(/skipped the signature/)).toBeNull());
    expect(mocks.ensureSessionToken).toHaveBeenCalledWith('alice');
    expect(isSignDeclined()).toBe(false);
  });

  it('keeps the notice if the user declines again', async () => {
    rememberSignDecline();
    mocks.ensureSessionToken.mockImplementation(async () => {
      rememberSignDecline();
      return null;
    });
    renderNotice('alice');
    fireEvent.click(await screen.findByRole('button', { name: 'Enable Snapie Points' }));
    await waitFor(() => expect(mocks.ensureSessionToken).toHaveBeenCalled());
    expect(await screen.findByText(/skipped the signature/)).toBeTruthy();
  });
});
