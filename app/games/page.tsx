'use client';
import { Box, Heading, SimpleGrid, Text, VStack, Card, CardBody, Button, Flex, Image } from '@chakra-ui/react';
import NextLink from 'next/link';
import { FiArrowRight } from 'react-icons/fi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoginModal } from '@/contexts/LoginModalContext';
import { usePointsSummary } from '@/hooks/usePointsSummary';
import { GAMES_FEATURE_FLAG } from '@/lib/points/config';
import snapieVictory from '@/components/games/puff-quest/assets/snapie-victory.png';
import snapieBlastCard from '@/components/games/snapie-blast/assets/snapie-blast-card.png';
import snapieRushCard from '@/components/games/snapie-rush/assets/snapie-rush-card.png';
import snapieJumpCard from '@/components/games/snapie-jump/assets/snapie-jump-card.png';
import type { GameId } from '@/lib/games/config';

const BLOCKS_CARD = { src: '/games/snapie-blocks-card.svg' };
const INFO_WAR_CARD = { src: '/games/snapie-info-war-card.svg' };

const GAMES_CATALOG: {
  id: GameId;
  name: string;
  tagline: string;
  href: string;
  image: { src: string };
  // 'cover' suits a photographic hero image; 'contain' keeps a pixel-art icon
  // fully visible instead of letting a wide/short card crop into it.
  imageFit: 'cover' | 'contain';
}[] = [
  {
    id: 'puff-quest',
    name: 'Snapie Quest',
    tagline: 'Inhale enemies, steal their powers, clear the keep.',
    href: '/games/puff-quest',
    image: snapieVictory,
    imageFit: 'cover',
  },
  {
    id: 'snapie-blast',
    name: 'Snapie Blast',
    tagline: 'Blast the swarm in this 8-bit shooting gallery. 60 seconds, 3 lives.',
    href: '/games/snapie-blast',
    image: snapieBlastCard,
    imageFit: 'contain',
  },
  {
    id: 'snapie-rush',
    name: 'Snapie Rush',
    tagline: 'Race the hover-bike through five routes. Watch the fuel, dodge the traffic.',
    href: '/games/snapie-rush',
    image: snapieRushCard,
    imageFit: 'contain',
  },
  {
    id: 'snapie-blocks',
    name: 'Snapie Blocks',
    tagline: '1v1 garbage battle. Last board standing wins.',
    href: '/games/snapie-blocks',
    image: BLOCKS_CARD,
    imageFit: 'contain',
  },
  {
    id: 'snapie-jump',
    name: 'Snapie Jump',
    tagline: 'Bounce up the hive, grab the honey and stomp the wasps. How high can you go?',
    href: '/games/snapie-jump',
    image: snapieJumpCard,
    imageFit: 'contain',
  },
  {
    id: 'snapie-info-war',
    name: 'Snapie: Information War',
    tagline: 'Run and gun through five worlds and take down the Hoard. Five bosses, upgradable weapons.',
    href: '/games/snapie-info-war',
    image: INFO_WAR_CARD,
    imageFit: 'contain',
  },
];

export default function GamesPage() {
  const { username, isLoggedIn } = useCurrentUser();
  const { openLoginModal } = useLoginModal();
  const points = usePointsSummary(username);

  if (!GAMES_FEATURE_FLAG) {
    return (
      <Box p={8} textAlign="center">
        <Heading>Games</Heading>
        <Text mt={4} color="fg.muted">
          Coming soon
        </Text>
      </Box>
    );
  }

  return (
    <Box p={8} maxW="1200px" mx="auto">
      <VStack align="stretch" spacing={8}>
        <Box>
          <Heading size="lg">Games</Heading>
          <Text mt={2} color="fg.muted">
            {isLoggedIn
              ? 'Play games and earn Snapie Points. Blocks pays out on a win.'
              : 'Snapie Blocks is open to guests. Log in to earn points — guest wins stay at zero.'}
          </Text>
          {isLoggedIn && (
            <Text mt={1} color="fg.muted">
              Balance: <strong>{points?.balance ?? '—'}</strong> Snapie Points
            </Text>
          )}
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {GAMES_CATALOG.map(game => {
            const guestLocked = !isLoggedIn && game.id !== 'snapie-blocks';
            const body = (
              <CardBody p={0}>
                <VStack align="stretch" spacing={0} h="full">
                  <Flex justify="center" align="center" h={40} bg="rgba(26,28,44,0.5)" borderRadius="0" position="relative">
                    <Image
                      src={game.image.src}
                      alt={game.name}
                      objectFit={game.imageFit}
                      w="full"
                      h="full"
                      opacity={0.7}
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </Flex>
                  <Box p={4}>
                    <VStack align="stretch" spacing={2}>
                      <Heading size="md">{game.name}</Heading>
                      <Text fontSize="sm" color="fg.muted">
                        {game.tagline}
                      </Text>
                    </VStack>
                  </Box>
                  <Box px={4} pb={4}>
                    <Button
                      as={guestLocked ? 'span' : undefined}
                      w="full"
                      rightIcon={<FiArrowRight />}
                      colorScheme="orange"
                      size="sm"
                    >
                      {guestLocked ? 'Log in to play' : 'Play'}
                    </Button>
                  </Box>
                </VStack>
              </CardBody>
            );
            if (guestLocked) {
              return (
                <Card
                  key={game.id}
                  as="button"
                  type="button"
                  onClick={openLoginModal}
                  textAlign="left"
                  w="full"
                  _hover={{ shadow: 'lg' }}
                  transition="all 0.2s"
                  overflow="hidden"
                >
                  {body}
                </Card>
              );
            }
            return (
              <Card
                key={game.id}
                as={NextLink}
                href={game.href}
                w="full"
                _hover={{ shadow: 'lg' }}
                transition="all 0.2s"
                overflow="hidden"
              >
                {body}
              </Card>
            );
          })}
        </SimpleGrid>
      </VStack>
    </Box>
  );
}
