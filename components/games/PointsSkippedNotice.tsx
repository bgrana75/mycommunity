'use client';
import { Button, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ensureSessionToken } from '@/lib/points/client';
import { clearSignDecline, isSignDeclined } from '@/lib/hive/walletSign';

export const SCORE_GAME_SKIPPED_BANNER =
  'Snapie Points are off because you skipped the signature. Saving a score will not award points.';

/** Shown on a score game's page after the user declined the Snapie Points
 *  signature, so a 0 balance isn't left unexplained. Same idea as the
 *  skipped-signature banner in Snapie Blocks. */
export function PointsSkippedNotice({ username }: { username: string | null }) {
  const [declined, setDeclined] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // sessionStorage is client-only, so read it after mount to match the server render.
  useEffect(() => setDeclined(isSignDeclined()), []);

  if (!declined || !username) return null;

  const enable = async () => {
    setEnabling(true);
    try {
      clearSignDecline();
      await ensureSessionToken(username);
      setDeclined(isSignDeclined());
    } finally {
      setEnabling(false);
    }
  };

  return (
    <VStack align="start" spacing={1}>
      <Text fontSize="sm" color="fg.muted">
        {SCORE_GAME_SKIPPED_BANNER}
      </Text>
      <Button variant="link" size="sm" colorScheme="orange" onClick={() => void enable()} isLoading={enabling}>
        Enable Snapie Points
      </Button>
    </VStack>
  );
}
