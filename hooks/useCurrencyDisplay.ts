import { useState, useEffect } from 'react';
import { getPayoutValue } from '@/lib/hive/client-functions';
import { convertHBDToDisplayCurrency } from '@/lib/utils/currencyConverter';

function hbdDisplayAmount(post: any, optimisticDeltaHBD: number): number {
  const baseAmount = parseFloat(getPayoutValue(post));
  return (isNaN(baseAmount) ? 0 : baseAmount) + optimisticDeltaHBD;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(3)}`;
}

// When rates are unavailable the converter answers with the plain USD string.
// Retry a few times so the display recovers once rates are back, without
// every feed card polling the rate API indefinitely.
const RETRY_DELAYS_MS = [15_000, 60_000];

/**
 * Display a post's payout in the configured currency.
 *
 * With no NEXT_PUBLIC_DISPLAY_CURRENCY, the USD/HBD string is computed
 * synchronously so feed cards never flash "$0.000" on mount (or when a
 * virtualized row remounts). Async conversion only runs when a display
 * currency is set; until it resolves we keep showing the sync HBD value.
 */
export function useCurrencyDisplay(post: any, optimisticDeltaHBD: number = 0): string {
  const targetCurrency = process.env.NEXT_PUBLIC_DISPLAY_CURRENCY?.trim() || '';
  // Effects key on the number, not `post`: callers often pass a fresh post
  // object every render, which would otherwise restart conversion forever.
  const amount = hbdDisplayAmount(post, optimisticDeltaHBD);
  const syncDisplay = formatUsd(amount);
  const [converted, setConverted] = useState<string | null>(null);

  useEffect(() => {
    if (!targetCurrency) {
      setConverted(null);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setConverted(null);

    const attempt = async (retry: number) => {
      const result = await convertHBDToDisplayCurrency(amount, targetCurrency);
      if (cancelled) return;
      setConverted(result);
      const failed = result === formatUsd(amount) && targetCurrency.toUpperCase() !== 'USD';
      if (failed && retry < RETRY_DELAYS_MS.length) {
        retryTimer = setTimeout(() => attempt(retry + 1), RETRY_DELAYS_MS[retry]);
      }
    };
    attempt(0);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [amount, targetCurrency]);

  if (!targetCurrency) return syncDisplay;
  return converted ?? syncDisplay;
}
