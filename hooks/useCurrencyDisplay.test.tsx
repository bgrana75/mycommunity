// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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
    vi.mocked(convertHBDToDisplayCurrency).mockReturnValue(
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
  });
});
