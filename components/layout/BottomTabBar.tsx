'use client';
import { Box, Flex, Text, Icon } from '@chakra-ui/react';
import { FiHome, FiBook, FiPlay, FiPlus, FiCreditCard } from 'react-icons/fi';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginModal } from '@/contexts/LoginModalContext';
import { useUnclaimedRewards } from '@/hooks/useUnclaimedRewards';

export default function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { username, isLoggedIn } = useCurrentUser();
  const { openLoginModal } = useLoginModal();
  const hasUnclaimed = useUnclaimedRewards();
  const walletHref = username ? `/@${username}/wallet` : '/wallet';

  function handleHomeClick(e: React.MouseEvent) {
    if (pathname === '/') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('snapie:go-home'));
    }
  }

  function handleComposeTap() {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }
    if (pathname.startsWith('/blog')) {
      router.push('/compose');
    } else if (pathname === '/') {
      document.getElementById('scrollableDiv')?.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        const ta = document.querySelector<HTMLTextAreaElement>('#snap-composer textarea');
        ta?.focus();
      }, 300);
    } else {
      router.push('/?focus=composer');
    }
  }

  // There is no wallet to open for a guest, so ask them to log in instead.
  function handleWalletClick(e: React.MouseEvent) {
    if (isLoggedIn) return;
    e.preventDefault();
    openLoginModal();
  }

  // Hide on immersive pages
  if (pathname === '/shorts') return null;

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path);

  return (
    <Box
      as="nav"
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      h="calc(60px + env(safe-area-inset-bottom))"
      pb="env(safe-area-inset-bottom)"
      pl="env(safe-area-inset-left)"
      pr="env(safe-area-inset-right)"
      boxSizing="border-box"
      bg="surface"
      borderTop="1px solid"
      borderTopColor="surfaceBorder"
      backdropFilter="blur(20px)"
      display={{ base: 'flex', sm: 'none' }}
      alignItems="center"
      zIndex={999}
      boxShadow="0 -4px 24px rgba(0,0,0,0.4)"
    >
      <Flex w="full" h="60px" align="center">
        {/* Home */}
        <Tab href="/" icon={FiHome} label="Home" active={isActive('/')} onClick={handleHomeClick} />

        {/* Blog */}
        <Tab href="/blog" icon={FiBook} label="Blogs" active={isActive('/blog')} />

        {/* Compose — elevated center CTA */}
        <Flex flex={1} justify="center" align="center">
          <Box
            as="button"
            onClick={handleComposeTap}
            aria-label="Compose"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="50px"
            h="50px"
            borderRadius="full"
            bgGradient="linear(135deg, #18a8ff, #66e4ff)"
            boxShadow="0 4px 22px rgba(28, 161, 241, 0.55)"
            color="white"
            mb="10px"
            transition="transform 0.15s, box-shadow 0.15s"
            _hover={{ transform: 'scale(1.08)', boxShadow: '0 6px 28px rgba(28, 161, 241, 0.7)' }}
            _active={{ transform: 'scale(0.94)' }}
          >
            <Icon as={FiPlus} boxSize={6} strokeWidth={2.5} />
          </Box>
        </Flex>

        {/* Shorts */}
        <Tab href="/shorts" icon={FiPlay} label="Shorts" active={isActive('/shorts')} />

        {/* Wallet */}
        <Tab href={walletHref} icon={FiCreditCard} label="Wallet" active={isActive('/wallet')} dot={hasUnclaimed} onClick={handleWalletClick} />
      </Flex>
    </Box>
  );
}

// ─── Tab item ─────────────────────────────────────────────────────────────────

interface TabProps {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  dot?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

function Tab({ href, icon, label, active, dot, onClick }: TabProps) {
  return (
    <Flex
      as={NextLink}
      href={href}
      prefetch={false}
      onClick={onClick}
      flex={1}
      direction="column"
      align="center"
      justify="center"
      h="full"
      color={active ? 'primary' : 'text'}
      opacity={active ? 1 : 0.55}
      transition="opacity 0.15s, color 0.15s"
      _hover={{ opacity: 1 }}
      gap="2px"
    >
      <Box position="relative" display="inline-flex">
        <Icon as={icon} boxSize={5} />
        {dot && (
          <Box
            position="absolute"
            top="-2px"
            right="-3px"
            w="7px"
            h="7px"
            borderRadius="full"
            bg="orange.400"
            boxShadow="0 0 6px rgba(251, 146, 60, 0.9)"
            border="1px solid"
            borderColor="background"
          />
        )}
      </Box>
      <Text fontSize="9px" letterSpacing="0.02em">{label}</Text>
    </Flex>
  );
}
