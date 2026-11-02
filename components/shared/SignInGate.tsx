'use client';

import { Box, Button, Heading, Icon, Spinner, Text, VStack } from '@chakra-ui/react';
import NextLink from 'next/link';
import type { IconType } from 'react-icons';
import { FiLogIn, FiUserPlus } from 'react-icons/fi';
import { useLoginModal } from '@/contexts/LoginModalContext';

/** Log in / Create account gate for pages that need a session. The modal
 *  behind Log in is the existing Google, email, and Hive wallet login. */
export function SignInGate({ icon, title, message }: { icon: IconType; title: string; message: string }) {
  const { openLoginModal } = useLoginModal();
  return (
    <Box maxW="480px" mx="auto" px={6} py={16} textAlign="center">
      <Icon as={icon} boxSize={8} color="primary" mb={4} />
      <Heading as="h1" size="md" mb={2}>{title}</Heading>
      <Text color="overlay.500" fontSize="sm" mb={6}>{message}</Text>
      <VStack spacing={3}>
        <Button
          w="full"
          maxW="280px"
          colorScheme="blue"
          borderRadius="12px"
          leftIcon={<Icon as={FiLogIn} />}
          onClick={openLoginModal}
        >
          Log in
        </Button>
        <Button
          w="full"
          maxW="280px"
          variant="outline"
          color="text"
          borderColor="rgba(28, 161, 241, 0.25)"
          borderRadius="12px"
          leftIcon={<Icon as={FiUserPlus} />}
          as={NextLink}
          href="/join"
        >
          Create account
        </Button>
      </VStack>
    </Box>
  );
}

/** Shown while the session restore is in flight, so a returning user is not
 *  flashed the guest gate. */
export function SessionStatus({ label }: { label: string }) {
  return (
    <Box maxW="480px" mx="auto" px={6} py={16} textAlign="center" role="status">
      <Spinner color="primary" mb={4} />
      <Text color="overlay.500" fontSize="sm">{label}</Text>
    </Box>
  );
}
