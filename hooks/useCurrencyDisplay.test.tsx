// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/utils/currencyConverter', () => ({
  convertHBDToDisplayCurrency: vi.fn(async (amount: number, currency: string) => `${currency}${amount.toFixed(2)}`),
}));

import { useCurrencyDisplay } from './useCurrencyDisplay';
import { convertHBDToDisplayCurrency } from '@/lib/utils/currencyConverter';

describe('useCurrencyDisplay', () => {
  const prevCurrency = process.env.NEXT_PUBLIC_DISPLAY_CURRENCY;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DISPLAY_CURRENCY;
    vi.mocked(convertHBDToDisplayCurrency).mockClear();
  });

  afterEach(() => {
    if (prevCurrency === undefined) delete process.env.NEXT_PUBLIC_DISPLAY_CURRENCY;
    else process.env.NEXT_PUBLIC_DISPLAY_CURRENCY = prevCurrency;
  });

  it('returns the real payout on the first render (no $0.000 flash)', () => {
    const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '');
    const { result } = renderHook(() =>
      useCurrencyDisplay({ created, pending_payout_value: '1.250 HBD' }),
    );
    expect(result.current).toBe('$1.250');
  });

  it('includes the optimistic vote delta immediately', () => {
    const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '');
    const { result } = renderHook(() =>
      useCurrencyDisplay({ created, pending_payout_value: '1.000 HBD' }, 0.05),
    );
    expect(result.current).toBe('$1.050');
  });

  it('keeps the sync HBD value until async conversion finishes', async () => {
    process.env.NEXT_PUBLIC_DISPLAY_CURRENCY = 'R$';
    let resolveConvert!: (value: string) => void;
    vi.mocked(convertHBDToDisplayCurrency).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveConvert = resolve;
      }),
    );

    const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '');
    const { result } = renderHook(() =>
      useCurrencyDisplay({ created, pending_payout_value: '2.000 HBD' }),
    );

    expect(result.current).toBe('$2.000');

    resolveConvert('R$10.00');
    await waitFor(() => expect(result.current).toBe('R$10.00'));
    // A fresh post object each render must not restart conversion for the same amount.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBe('R$10.00');
    expect(convertHBDToDisplayCurrency).toHaveBeenCalledTimes(1);
  });

  it('converts again when the payout amount changes', async () => {
    process.env.NEXT_PUBLIC_DISPLAY_CURRENCY = 'R$';
    const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '');
    const { result, rerender } = renderHook(
      ({ delta }) => useCurrencyDisplay({ created, pending_payout_value: '2.000 HBD' }, delta),
      { initialProps: { delta: 0 } },
    );

    await waitFor(() => expect(result.current).toBe('R$2.00'));
    rerender({ delta: 0.5 });
    await waitFor(() => expect(result.current).toBe('R$2.50'));
    expect(convertHBDToDisplayCurrency).toHaveBeenCalledTimes(2);
  });

  it('retries a failed conversion a bounded number of times', async () => {
    vi.useFakeTimers();
    try {
      process.env.NEXT_PUBLIC_DISPLAY_CURRENCY = 'BRL';
      // Rates unavailable: the converter falls back to the USD string.
      vi.mocked(convertHBDToDisplayCurrency)
        .mockResolvedValueOnce('$2.000')
        .mockResolvedValueOnce('R$10.00');
      const created = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace('Z', '');
      const { result } = renderHook(() =>
        useCurrencyDisplay({ created, pending_payout_value: '2.000 HBD' }),
      );

      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(result.current).toBe('$2.000');
      await act(() => vi.advanceTimersByTimeAsync(15_000));
      expect(result.current).toBe('R$10.00');
      expect(convertHBDToDisplayCurrency).toHaveBeenCalledTimes(2);

      // Rates down for good: two retries, then it stops.
      vi.mocked(convertHBDToDisplayCurrency).mockClear();
      vi.mocked(convertHBDToDisplayCurrency)
        .mockResolvedValueOnce('$3.000')
        .mockResolvedValueOnce('$3.000')
        .mockResolvedValueOnce('$3.000');
      const down = renderHook(() =>
        useCurrencyDisplay({ created, pending_payout_value: '3.000 HBD' }),
      );
      await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
      expect(down.result.current).toBe('$3.000');
      expect(convertHBDToDisplayCurrency).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
