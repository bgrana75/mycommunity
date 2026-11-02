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
  const syncDisplay = formatUsd(hbdDisplayAmount(post, optimisticDeltaHBD));
  const [converted, setConverted] = useState<string | null>(null);

  useEffect(() => {
    if (!targetCurrency) {
      setConverted(null);
      return;
    }

    let cancelled = false;
    setConverted(null);

    (async () => {
      const amount = hbdDisplayAmount(post, optimisticDeltaHBD);
      const result = await convertHBDToDisplayCurrency(amount, targetCurrency);
      if (!cancelled) setConverted(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [post, targetCurrency, optimisticDeltaHBD]);

  if (!targetCurrency) return syncDisplay;
  return converted ?? syncDisplay;
}
