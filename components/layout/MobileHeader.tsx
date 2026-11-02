'use client';
import { Box, Flex, Text, Icon, IconButton, Button } from '@chakra-ui/react';
import { FiBell, FiMenu } from 'react-icons/fi';
import { FaMicrophone } from 'react-icons/fa';
import { keyframes } from '@emotion/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginModal } from '@/contexts/LoginModalContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { usePathname } from 'next/navigation';
import { Avatar } from '@/components/shared/Avatar';
import { MoodBadgeIcon } from '@/components/shared/MoodBadgeIcon';
import { useMoodBadges } from '@/hooks/useMoodBadges';
import NextLink from 'next/link';
import { CountBadge } from '@/components/ui/CountBadge';
import { useOpenPodsCount } from '@/hooks/useOpenPodsCount';

const micPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.45; }
`;

interface MobileHeaderProps {
  onMePress: () => void;
}

export default function MobileHeader({ onMePress }: MobileHeaderProps) {
  const { username: user, isLoggedIn } = useCurrentUser();
  const { openLoginModal } = useLoginModal();
  const { unreadCount } = useNotifications();
  const pathname = usePathname();
  const openPodsCount = useOpenPodsCount();
  const { getEquippedBadge } = useMoodBadges();

  // Immersive pages manage their own chrome
  if (pathname === '/shorts') return null;

  return (
    <Box
      as="header"
      position="fixed"
      top={0}
      left={0}
      right={0}
      // 56px of chrome, plus the notch inset when launched standalone.
      // env() is 0 in a normal browser tab, so this stays 56px there.
      h="calc(56px + env(safe-area-inset-top))"
      pt="env(safe-area-inset-top)"
      pl="max(16px, env(safe-area-inset-left))"
      pr="max(16px, env(safe-area-inset-right))"
      boxSizing="border-box"
      bg="surface"
      borderBottom="1px solid"
      borderBottomColor="surfaceBorder"
      backdropFilter="blur(20px)"
      display={{ base: 'flex', sm: 'none' }}
      alignItems="center"
      justifyContent="space-between"
      zIndex={998}
      boxShadow="0 2px 24px rgba(0,0,0,0.35)"
    >
      {/* Wordmark */}
      <Text
        fontSize="2xl"
        fontWeight="extrabold"
        letterSpacing="-0.04em"
        bgGradient="linear(to-r, #18a8ff, #66e4ff)"
        bgClip="text"
        userSelect="none"
      >
        snapie.io
      </Text>

      {/* Right: actions */}
      <Flex align="center" gap={1}>
        {isLoggedIn && user ? (
          <>
            {/* Notifications */}
            <Box position="relative">
              <IconButton
                as={NextLink}
                href={`/@${user}/notifications`}
                aria-label="Notifications"
                icon={<Icon as={FiBell} boxSize={5} />}
                variant="ghost"
                color={unreadCount > 0 ? 'red.300' : 'overlay.700'}
                size="sm"
                borderRadius="full"
                _hover={{ bg: 'overlay.100' }}
              />
              <CountBadge count={unreadCount} colorScheme="red" top="-2px" right="-2px" />
            </Box>

            {/* OpenPods live indicator */}
            {openPodsCount > 0 && (
              <Box position="relative">
                <IconButton
                  as={NextLink}
                  href="/hangouts"
                  aria-label={`${openPodsCount} OpenPod${openPodsCount !== 1 ? 's' : ''} live`}
                  icon={<Icon as={FaMicrophone} boxSize={4} animation={`${micPulse} 2s ease-in-out infinite`} />}
                  variant="ghost"
                  color="red.300"
                  size="sm"
                  borderRadius="full"
                  _hover={{ bg: 'overlay.100' }}
                />
                <CountBadge count={openPodsCount} colorScheme="red" top="-2px" right="-2px" />
              </Box>
            )}

            {/* Avatar → opens MeSheet */}
            <Box
              as="button"
              onClick={onMePress}
              borderRadius="full"
              boxSize="34px"
              border="2px solid rgba(28, 161, 241, 0.35)"
              boxShadow="0 0 12px rgba(28, 161, 241, 0.2)"
              flexShrink={0}
              transition="box-shadow 0.15s"
              _hover={{ boxShadow: '0 0 16px rgba(28, 161, 241, 0.4)' }}
            >
              <Avatar
                username={user}
                size="34px"
                overlay={
                  getEquippedBadge(user)
                    ? <MoodBadgeIcon sku={getEquippedBadge(user)!} username={user} size="18px" />
                    : undefined
                }
              />
            </Box>
          </>
        ) : (
          <>
            {/* Without this, logged-out visitors had no way to open MeSheet
                at all — Explore/Support/About were unreachable on mobile. */}
            <IconButton
              aria-label="Menu"
              icon={<Icon as={FiMenu} boxSize={5} />}
              variant="ghost"
              color="overlay.700"
              size="sm"
              borderRadius="full"
              _hover={{ bg: 'overlay.100' }}
              onClick={onMePress}
            />
            <Button
              size="sm"
              colorScheme="blue"
              borderRadius="full"
              px={4}
              onClick={openLoginModal}
            >
              Log in
            </Button>
          </>
        )}
      </Flex>
    </Box>
  );
}
