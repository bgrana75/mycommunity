'use client';
import { Box, Button, Heading, HStack, Link as ChakraLink, Text, VStack, useToast } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginModal } from '@/contexts/LoginModalContext';
import { usePointsSummary } from '@/hooks/usePointsSummary';
import { PointsSkippedNotice } from '@/components/games/PointsSkippedNotice';
import { GAMES_FEATURE_FLAG } from '@/lib/points/config';
import { saveGameScore } from '@/lib/games/scoreClient';
import { notEnoughPointsToast } from '@/components/shared/NotEnoughPointsToast';
import { SnapieInfoWar } from '@/components/games/snapie-info-war/SnapieInfoWar';
import type { SnapieResult, SnapieEvent } from '@/components/games/snapie-info-war/types';

export default function SnapieInfoWarPage() {
  const { username, isLoggedIn } = useCurrentUser();
  const { openLoginModal } = useLoginModal();
  const points = usePointsSummary(username);
  const toast = useToast();

  // Assigned after mount so server and client render the same tree.
  // crypto.randomUUID() during render diverges, and the shell mounts only
  // once this id exists. The canvas engine still loads in an effect.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SnapieResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'duplicate'>('idle');
  const [savedPointsAwarded, setSavedPointsAwarded] = useState(0);

  useEffect(() => {
    setSessionId((current) => current ?? crypto.randomUUID());
  }, []);

  if (!GAMES_FEATURE_FLAG) {
    return (
      <Box p={8} textAlign="center">
        <Heading>Snapie: Information War</Heading>
        <Text mt={4} color="fg.muted">
          Not available yet
        </Text>
      </Box>
    );
  }

  if (!isLoggedIn) {
    return (
      <Box p={8} textAlign="center">
        <Heading>Snapie: Information War</Heading>
        <Text mt={4} color="fg.muted">
          Please log in to play
        </Text>
        <Button mt={6} onClick={openLoginModal}>
          Log In
        </Button>
      </Box>
    );
  }

  const handleGameEvent = (event: SnapieEvent) => {
    // Regenerate sessionId on game-over or win so the next run gets a fresh session,
    // same pattern as Snapie Quest — the SDK reacts to sessionId prop changes rather
    // than needing a remount.
    if (event.type === 'game-over' || event.type === 'win') {
      setSessionId(crypto.randomUUID());
    }
  };

  const handleGameResult = (result: SnapieResult) => {
    setLastResult(result);
    setSaveStatus('idle');
    setSavedPointsAwarded(0);
  };

  const handleSaveScore = async () => {
    if (!username || !lastResult) return;

    setSaveStatus('saving');
    try {
      const result = await saveGameScore(username, 'snapie-info-war', lastResult);

      if (result.status === 'awarded') {
        setSaveStatus('saved');
        setSavedPointsAwarded(result.pointsAwarded);
        toast({
          title: 'Score Saved!',
          description: `You earned ${result.pointsAwarded} Snapie Points.`,
          status: 'success',
          duration: 4000,
          isClosable: true,
        });
      } else if (result.status === 'duplicate') {
        setSaveStatus('duplicate');
        setSavedPointsAwarded(result.pointsAwarded);
        toast({
          title: 'Score Already Saved',
          description: `You already earned ${result.pointsAwarded} Snapie Points for this run.`,
          status: 'info',
          duration: 4000,
          isClosable: true,
        });
      } else if (result.status === 'capped') {
        setSaveStatus('error');
        toast(
          notEnoughPointsToast(
            0,
            "You've reached your daily points limit. Try again tomorrow!",
          ),
        );
      } else {
        setSaveStatus('error');
        toast({
          title: 'Error',
          description: 'Could not save your score. Please try again.',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }
    } catch (err) {
      setSaveStatus('error');
      toast({
        title: 'Error',
        description: 'Could not save your score. Please try again.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const resultSlot = lastResult ? (
    <VStack spacing={3} w="full" maxW="360px">
      {saveStatus === 'saved' || saveStatus === 'duplicate' ? (
        <VStack spacing={2} w="full" textAlign="center">
          <Text fontSize="sm" color="success" fontWeight="bold">
            ✓ Saved — +{savedPointsAwarded} Snapie Points
          </Text>
          <Text fontSize="xs" color="fg.muted">
            Current Balance: {points?.balance ?? '—'}
          </Text>
        </VStack>
      ) : (
        <Button
          w="full"
          colorScheme="orange"
          onClick={handleSaveScore}
          isDisabled={saveStatus === 'saving'}
          isLoading={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save Score'}
        </Button>
      )}
    </VStack>
  ) : null;

  return (
    <VStack spacing={6} p={6} align="stretch" maxW="1000px" mx="auto">
      <HStack>
        <ChakraLink as={NextLink} href="/games" color="accent" display="flex" alignItems="center" gap={1}>
          <Text>← Back to Games</Text>
        </ChakraLink>
      </HStack>

      <VStack align="start" spacing={2}>
        <Heading size="lg">Snapie: Information War</Heading>
        <Text color="fg.muted">
          Balance: <strong>{points?.balance ?? '—'}</strong> Snapie Points
        </Text>
        <PointsSkippedNotice username={username} />
      </VStack>

      <Box w="full" flex={1}>
        {sessionId && (
          <SnapieInfoWar
            playerName={username || undefined}
            sessionId={sessionId}
            autoStart
            onEvent={handleGameEvent}
            onResult={handleGameResult}
            resultSlot={resultSlot}
          />
        )}
      </Box>
    </VStack>
  );
}
