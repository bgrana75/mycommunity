'use client'
import { useState, useEffect } from 'react';
import HiveClient from '@/lib/hive/hiveclient';

const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

interface HbdSavingsInterest {
  pendingInterest: number;
  annualRatePct: number;
  isLoading: boolean;
}

export function useHbdSavingsInterest(hiveAccount: any): HbdSavingsInterest {
  const [pendingInterest, setPendingInterest] = useState(0);
  const [annualRatePct, setAnnualRatePct] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!hiveAccount) return;

    const savingsBalance = parseFloat(hiveAccount.savings_hbd_balance) || 0;
    if (savingsBalance === 0) {
      setPendingInterest(0);
      return;
    }

    setIsLoading(true);
    HiveClient.call('condenser_api', 'get_dynamic_global_properties', [])
      .then((props: any) => {
        const rateBps = props.hbd_interest_rate || 0; // basis points, e.g. 2000 = 20%
        setAnnualRatePct(rateBps / 100);

        // savings_hbd_seconds is accumulated in chain units (0.001 HBD x seconds),
        // while savingsBalance is in whole HBD, so convert before adding.
        const accSeconds = parseInt(hiveAccount.savings_hbd_seconds || '0') / 1000;
        const lastUpdate = new Date(hiveAccount.savings_hbd_seconds_last_update + 'Z').getTime();
        const elapsedSeconds = Math.max(0, (Date.now() - lastUpdate) / 1000);
        const totalHbdSeconds = accSeconds + savingsBalance * elapsedSeconds;
        const interest = totalHbdSeconds * (rateBps / 10000) / SECONDS_PER_YEAR;

        setPendingInterest(interest);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [hiveAccount]);

  return { pendingInterest, annualRatePct, isLoading };
}
