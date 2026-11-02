'use client';
import { useState } from 'react';
import {
  Drawer, DrawerOverlay, DrawerContent, DrawerBody,
  Flex, Box, Text, Icon, Button, VStack, Divider, Badge,
} from '@chakra-ui/react';
import {
  FiUser, FiCreditCard, FiBell, FiRadio, FiMessageSquare, FiMessageCircle,
  FiLogIn, FiUserPlus, FiLogOut, FiInfo, FiCompass, FiHeart, FiSettings, FiAward, FiZap, FiPackage,
} from 'react-icons/fi';
import FeedbackModal from '@/components/feedback/FeedbackModal';
import NextLink from 'next/link';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginModal } from '@/contexts/LoginModalContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useOpenPodsCount } from '@/hooks/useOpenPodsCount';
import { Avatar } from '@/components/shared/Avatar';
import { MoodBadgeIcon } from '@/components/shared/MoodBadgeIcon';
import { useMoodBadges } from '@/hooks/useMoodBadges';
import { POINTS_FEATURE_FLAG, GAMES_FEATURE_FLAG } from '@/lib/points/config';
import HiveActivityWidget from './HiveActivityWidget';

interface MeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleChat: () => void;
  chatUnreadCount: number;
}

export default function MeSheet({ isOpen, onClose, onToggleChat, chatUnreadCount }: MeSheetProps) {
  const { username: user, isLoggedIn, logout } = useCurrentUser();
  const { openLoginModal } = useLoginModal();
  const { unreadCount } = useNotifications();
  const openPodsCount = useOpenPodsCount();
  const { getEquippedBadge } = useMoodBadges();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
    <Drawer isOpen={isOpen} onClose={onClose} placement="bottom">
      <DrawerOverlay bg="blackAlpha.600" backdropFilter="blur(6px)" />
      <DrawerContent
        bg="background"
        borderTopRadius="24px"
        backdropFilter="blur(24px)"
        border="1px solid"
        borderColor="surfaceBorder"
        maxH="82dvh"
        pb="env(safe-area-inset-bottom)"
      >
        <DrawerBody p={0} overflowY="auto">
          {/* Drag handle */}
          <Flex justify="center" pt={3} pb={2} flexShrink={0}>
            <Box w="36px" h="4px" borderRadius="full" bg="overlay.300" />
          </Flex>

          {isLoggedIn && user && (
            <>
              {/* Identity card */}
              <Flex align="center" gap={3} px={5} pt={2} pb={4}>
                <Avatar
                  username={user}
                  size="60px"
                  flexShrink={0}
                  sx={{
                    border: '2px solid rgba(28, 161, 241, 0.4)',
                    boxShadow: '0 0 20px rgba(28, 161, 241, 0.22)',
                  }}
                  overlay={
                    getEquippedBadge(user)
                      ? <MoodBadgeIcon sku={getEquippedBadge(user)!} username={user} size="26px" />
                      : undefined
                  }
                />
                <Box overflow="hidden">
                  <Text color="text" fontWeight="bold" fontSize="lg" noOfLines={1}>
                    @{user}
                  </Text>
                  <Text color="overlay.500" fontSize="xs">Logged in</Text>
                </Box>
              </Flex>

              <Divider borderColor="rgba(28, 161, 241, 0.08)" />
            </>
          )}

          {/* Navigation links — the account-agnostic ones (Explore, OpenPods,
              Support, About) are visible whether or not you're logged in,
              mirroring the desktop Sidebar's "these aren't behind a login"
              placement. Without this, a logged-out mobile visitor had no way
              to reach any secondary page at all — only a Log in button. */}
          <VStack spacing={0} py={2}>
            <SheetLink href="/explore" icon={FiCompass} label="Explore" onClose={onClose} />
            {POINTS_FEATURE_FLAG && (
              <SheetLink href="/leaderboard" icon={FiAward} label="Leaderboard" onClose={onClose} />
            )}
            {GAMES_FEATURE_FLAG && (
              <SheetLink href="/games" icon={FiZap} label="Games" onClose={onClose} />
            )}
            <SheetLink href="/factory" icon={FiPackage} label="Butter Factory" onClose={onClose} />
            {isLoggedIn && user && (
              <>
                <SheetLink href={`/@${user}`} icon={FiUser} label="My Profile" onClose={onClose} />
                <SheetLink href={`/@${user}/wallet`} icon={FiCreditCard} label="Wallet" onClose={onClose} />
                <SheetLink href={`/@${user}/notifications`} icon={FiBell} label="Notifications" badge={unreadCount} onClose={onClose} />
              </>
            )}
            <SheetLink href="/hangouts" icon={FiRadio} label="OpenPods" badge={openPodsCount} onClose={onClose} />
            {isLoggedIn && user && (
              <SheetLink href="/settings" icon={FiSettings} label="Settings" onClose={onClose} />
            )}
            {isLoggedIn && user && (
              <SheetButton
                icon={FiMessageSquare}
                label="Chat"
                badge={chatUnreadCount}
                onClick={() => { onClose(); onToggleChat(); }}
              />
            )}
            <SheetButton
              icon={FiMessageCircle}
              label="Send feedback"
              onClick={() => { onClose(); setFeedbackOpen(true); }}
            />
            <SheetLink href="/support" icon={FiHeart} label="Support Snapie" onClose={onClose} />
            <SheetLink href="https://about.snapie.io" icon={FiInfo} label="About Snapie" external onClose={onClose} />
          </VStack>

          <Divider borderColor="rgba(28, 161, 241, 0.08)" />

          {isLoggedIn && user ? (
            <>
              {/* Hive activity indicator */}
              <Box px={2} pb={1}>
                <HiveActivityWidget />
              </Box>

              {/* Logout */}
              <Box px={4} py={4}>
                <Button
                  w="full"
                  variant="ghost"
                  color="red.400"
                  leftIcon={<Icon as={FiLogOut} />}
                  borderRadius="12px"
                  _hover={{ bg: 'rgba(255, 80, 80, 0.08)' }}
                  onClick={() => { logout(); onClose(); }}
                >
                  Log out
                </Button>
              </Box>
            </>
          ) : (
            /* Not logged in */
            <Box px={5} py={6}>
              <Text color="text" fontWeight="bold" fontSize="lg" mb={1}>
                Welcome to Snapie
              </Text>
              <Text color="overlay.500" fontSize="sm" mb={6}>
                Log in to post, vote, and connect with the community.
              </Text>
              <VStack spacing={3}>
                <Button
                  w="full"
                  colorScheme="blue"
                  borderRadius="12px"
                  leftIcon={<Icon as={FiLogIn} />}
                  onClick={() => { openLoginModal(); onClose(); }}
                >
                  Log in
                </Button>
                <Button
                  w="full"
                  variant="outline"
                  color="text"
                  borderColor="rgba(28, 161, 241, 0.25)"
                  borderRadius="12px"
                  leftIcon={<Icon as={FiUserPlus} />}
                  as={NextLink}
                  href="/join"
                  onClick={onClose}
                >
                  Create account
                </Button>
              </VStack>
            </Box>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
    <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}

// ─── Row helpers ─────────────────────────────────────────────────────────────

interface SheetLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  external?: boolean;
  onClose: () => void;
}

function SheetLink({ href, icon, label, badge = 0, external, onClose }: SheetLinkProps) {
  return (
    <Flex
      as={external ? 'a' : NextLink}
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      align="center"
      gap={3}
      px={5}
      py={3}
      w="full"
      cursor="pointer"
      color="text"
      _hover={{ bg: 'overlay.50' }}
      transition="background 0.12s"
      onClick={onClose}
    >
      <Icon as={icon} boxSize={5} color="overlay.600" />
      <Text fontSize="sm" flex={1}>{label}</Text>
      {badge > 0 && <Badge colorScheme="red" borderRadius="full" fontSize="xs" px={2}>{badge}</Badge>}
    </Flex>
  );
}

interface SheetButtonProps {
  icon: React.ElementType;
  label: string;
  badge?: number;
  onClick: () => void;
}

function SheetButton({ icon, label, badge = 0, onClick }: SheetButtonProps) {
  return (
    <Flex
      align="center"
      gap={3}
      px={5}
      py={3}
      w="full"
      cursor="pointer"
      color="text"
      _hover={{ bg: 'overlay.50' }}
      transition="background 0.12s"
      onClick={onClick}
    >
      <Icon as={icon} boxSize={5} color="overlay.600" />
      <Text fontSize="sm" flex={1}>{label}</Text>
      {badge > 0 && <Badge colorScheme="red" borderRadius="full" fontSize="xs" px={2}>{badge}</Badge>}
    </Flex>
  );
}
