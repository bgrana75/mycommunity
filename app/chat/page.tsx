'use client';

import { Box, Button, Heading, Icon, Text } from '@chakra-ui/react';
import { useEffect } from 'react';
import { FiMessageSquare } from 'react-icons/fi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSnapieAuth } from '@/contexts/SnapieAuthContext';
import { SessionStatus, SignInGate } from '@/components/shared/SignInGate';
import { requestOpenChat } from '@/lib/chat/openChat';

/**
 * /chat is not a profile or post, so it used to match app/[...slug] and
 * SlugPageClient returned null. The shell (nav) still rendered, and the main
 * area was empty — no conversation UI and no sign-in prompt. Logged-out
 * visitors now get the same Log in / Create account gate as the Me sheet.
 * The modal behind Log in is the existing Google, email, and Hive wallet login.
 */
export default function ChatPage() {
  const { isLoggedIn, username } = useCurrentUser();
  const { isLoading } = useSnapieAuth();

  useEffect(() => {
    if (!isLoggedIn || !username) return;
    requestOpenChat();
  }, [isLoggedIn, username]);

  if (!isLoggedIn || !username) {
    // Hold the gate until session restore settles, so a returning user is
    // not told to sign in while their session is still coming back.
    if (isLoading) return <SessionStatus label="Checking session" />;
    return (
      <SignInGate
        icon={FiMessageSquare}
        title="Sign in to chat"
        message="Log in with Google, email, or your Hive wallet to join conversations."
      />
    );
  }

  return (
    <Box maxW="480px" mx="auto" px={6} py={16} textAlign="center">
      <Icon as={FiMessageSquare} boxSize={8} color="primary" mb={4} />
      <Heading as="h1" size="md" mb={2}>Chat</Heading>
      <Text color="overlay.500" fontSize="sm" mb={6}>
        Your conversations are in the chat panel.
      </Text>
      <Button colorScheme="blue" borderRadius="12px" onClick={requestOpenChat}>
        Open chat
      </Button>
    </Box>
  );
}
