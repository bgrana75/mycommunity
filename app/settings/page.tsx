'use client';
import {
    Box, Flex, Heading, Text, VStack, Icon, Divider, Button, Wrap, WrapItem, Tag,
} from '@chakra-ui/react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import NextLink from 'next/link';
import { FiZap, FiDollarSign, FiMoon, FiSun, FiCompass, FiGift, FiChevronRight, FiAward, FiCheckSquare, FiFileText, FiShoppingCart, FiSmile, FiEyeOff, FiTarget, FiPackage, FiMessageCircle } from 'react-icons/fi';
import FeedbackModal from '@/components/feedback/FeedbackModal';
import { useUserSettings, type PayoutType, type ColorMode } from '@/hooks/useUserSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isDiscoveryEnabledFor } from '@/lib/discovery/config';
import { isPointsEnabledFor, ROULETTE_FEATURE_FLAG, ITEM_MARKET_FEATURE_FLAG } from '@/lib/points/config';
import { usePointsSummary } from '@/hooks/usePointsSummary';
import { INTEREST_TOPICS } from '@/lib/discovery/interestTopics';
import ContentFiltersSettings from '@/components/contentFilter/ContentFiltersSettings';

const InterestPicker = dynamic(() => import('@/components/onboarding/InterestPicker'), { ssr: false });

interface PayoutOption {
    value: PayoutType;
    icon: React.ElementType;
    label: string;
    sublabel: string;
    description: string;
}

const PAYOUT_OPTIONS: PayoutOption[] = [
    {
        value: 'half_hbd',
        icon: FiDollarSign,
        label: '50 / 50',
        sublabel: 'Default',
        description: 'Half paid as HBD (liquid), half as Hive Power.',
    },
    {
        value: 'power_up_100',
        icon: FiZap,
        label: 'Power Up 100%',
        sublabel: 'All HP',
        description: 'Full payout converted to Hive Power. Grows your influence on the network.',
    },
];

interface AppearanceOption {
    value: ColorMode;
    icon: React.ElementType;
    label: string;
    sublabel: string;
    description: string;
}

const APPEARANCE_OPTIONS: AppearanceOption[] = [
    {
        value: 'dark',
        icon: FiMoon,
        label: 'Dark',
        sublabel: 'Default',
        description: 'The classic Snapie look.',
    },
    {
        value: 'light',
        icon: FiSun,
        label: 'Light',
        sublabel: 'New',
        description: 'A brighter, high-contrast theme.',
    },
];

export default function SettingsPage() {
    const { settings, update } = useUserSettings();
    const { username } = useCurrentUser();
    const [isInterestPickerOpen, setIsInterestPickerOpen] = useState(false);
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    // Discovery Engine Phase 2 — same flag+allowlist gate as everywhere else
    // this feature appears (see lib/discovery/config.ts). Invisible to
    // everyone else, so there's nothing confusing left behind if the feature
    // is ever turned off again.
    const showInterestsSection = isDiscoveryEnabledFor(username);
    const selectedTopicLabels = INTEREST_TOPICS.filter(topic =>
        topic.tags.some(tag => settings.interestTags.includes(tag)),
    );

    const showPointsSection = isPointsEnabledFor(username);
    const points = usePointsSummary(showPointsSection ? username : null);
    const showRoulette = showPointsSection && ROULETTE_FEATURE_FLAG;
    const showItemMarket = showPointsSection && ITEM_MARKET_FEATURE_FLAG;

    return (
        <Box maxW="640px" mx="auto" px={{ base: 4, md: 8 }} py={10}>
            <Heading size="lg" fontWeight="bold" color="text" mb={1}>
                Settings
            </Heading>
            <Text color="overlay.500" fontSize="sm" mb={8}>
                Your preferences are saved locally on this device.
            </Text>

            {/* Appearance section */}
            <Box
                bg="surface"
                borderRadius="16px"
                border="1px solid"
                borderColor="surfaceBorder"
                backdropFilter="blur(18px)"
                overflow="hidden"
                mb={6}
            >
                <Box px={6} py={4}>
                    <Text fontSize="xs" fontWeight="semibold" color="overlay.500" textTransform="uppercase" letterSpacing="0.08em">
                        Appearance
                    </Text>
                </Box>

                <Divider borderColor="surfaceBorder" />

                <Box px={6} py={5}>
                    <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                        Theme
                    </Text>
                    <Text color="overlay.500" fontSize="xs" mb={5}>
                        Applies across the app on this device.
                    </Text>

                    <VStack spacing={3} align="stretch">
                        {APPEARANCE_OPTIONS.map(opt => {
                            const selected = settings.colorMode === opt.value;
                            return (
                                <Flex
                                    key={opt.value}
                                    as="button"
                                    onClick={() => update({ colorMode: opt.value })}
                                    align="center"
                                    gap={4}
                                    px={4}
                                    py={4}
                                    borderRadius="12px"
                                    border="1px solid"
                                    borderColor={selected ? 'rgba(28, 161, 241, 0.55)' : 'surfaceBorder'}
                                    bg={selected ? 'rgba(28, 161, 241, 0.08)' : 'surface'}
                                    cursor="pointer"
                                    transition="all 0.15s"
                                    _hover={{
                                        borderColor: 'rgba(28, 161, 241, 0.35)',
                                        bg: 'rgba(28, 161, 241, 0.06)',
                                    }}
                                    textAlign="left"
                                    w="full"
                                >
                                    {/* Radio dot */}
                                    <Box
                                        flexShrink={0}
                                        w="18px"
                                        h="18px"
                                        borderRadius="full"
                                        border="2px solid"
                                        borderColor={selected ? 'primary' : 'overlay.300'}
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                    >
                                        {selected && (
                                            <Box w="8px" h="8px" borderRadius="full" bg="primary" />
                                        )}
                                    </Box>

                                    {/* Icon */}
                                    <Flex
                                        flexShrink={0}
                                        w="36px"
                                        h="36px"
                                        borderRadius="10px"
                                        bg={selected ? 'rgba(28, 161, 241, 0.15)' : 'overlay.50'}
                                        align="center"
                                        justify="center"
                                    >
                                        <Icon as={opt.icon} boxSize={4} color={selected ? 'primary' : 'overlay.500'} />
                                    </Flex>

                                    {/* Text */}
                                    <Box flex={1} overflow="hidden">
                                        <Flex align="center" gap={2} mb="2px">
                                            <Text color="text" fontWeight="semibold" fontSize="sm">
                                                {opt.label}
                                            </Text>
                                            <Text
                                                fontSize="10px"
                                                fontWeight="medium"
                                                color={selected ? 'primary' : 'overlay.400'}
                                                bg={selected ? 'rgba(28, 161, 241, 0.12)' : 'overlay.50'}
                                                px={2}
                                                py="1px"
                                                borderRadius="full"
                                            >
                                                {opt.sublabel}
                                            </Text>
                                        </Flex>
                                        <Text color="overlay.500" fontSize="xs" noOfLines={2}>
                                            {opt.description}
                                        </Text>
                                    </Box>
                                </Flex>
                            );
                        })}
                    </VStack>
                </Box>
            </Box>

            {/* Posting section */}
            <Box
                bg="surface"
                borderRadius="16px"
                border="1px solid"
                borderColor="surfaceBorder"
                backdropFilter="blur(18px)"
                overflow="hidden"
            >
                <Box px={6} py={4}>
                    <Text fontSize="xs" fontWeight="semibold" color="overlay.500" textTransform="uppercase" letterSpacing="0.08em">
                        Posting
                    </Text>
                </Box>

                <Divider borderColor="surfaceBorder" />

                <Box px={6} py={5}>
                    <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                        Payout preference
                    </Text>
                    <Text color="overlay.500" fontSize="xs" mb={5}>
                        Applies to all new snaps and blog posts.
                    </Text>

                    <VStack spacing={3} align="stretch">
                        {PAYOUT_OPTIONS.map(opt => {
                            const selected = settings.payoutType === opt.value;
                            return (
                                <Flex
                                    key={opt.value}
                                    as="button"
                                    onClick={() => update({ payoutType: opt.value })}
                                    align="center"
                                    gap={4}
                                    px={4}
                                    py={4}
                                    borderRadius="12px"
                                    border="1px solid"
                                    borderColor={selected ? 'rgba(28, 161, 241, 0.55)' : 'surfaceBorder'}
                                    bg={selected ? 'rgba(28, 161, 241, 0.08)' : 'surface'}
                                    cursor="pointer"
                                    transition="all 0.15s"
                                    _hover={{
                                        borderColor: 'rgba(28, 161, 241, 0.35)',
                                        bg: 'rgba(28, 161, 241, 0.06)',
                                    }}
                                    textAlign="left"
                                    w="full"
                                >
                                    {/* Radio dot */}
                                    <Box
                                        flexShrink={0}
                                        w="18px"
                                        h="18px"
                                        borderRadius="full"
                                        border="2px solid"
                                        borderColor={selected ? 'primary' : 'overlay.300'}
                                        display="flex"
                                        alignItems="center"
                                        justifyContent="center"
                                    >
                                        {selected && (
                                            <Box w="8px" h="8px" borderRadius="full" bg="primary" />
                                        )}
                                    </Box>

                                    {/* Icon */}
                                    <Flex
                                        flexShrink={0}
                                        w="36px"
                                        h="36px"
                                        borderRadius="10px"
                                        bg={selected ? 'rgba(28, 161, 241, 0.15)' : 'overlay.50'}
                                        align="center"
                                        justify="center"
                                    >
                                        <Icon as={opt.icon} boxSize={4} color={selected ? 'primary' : 'overlay.500'} />
                                    </Flex>

                                    {/* Text */}
                                    <Box flex={1} overflow="hidden">
                                        <Flex align="center" gap={2} mb="2px">
                                            <Text color="text" fontWeight="semibold" fontSize="sm">
                                                {opt.label}
                                            </Text>
                                            <Text
                                                fontSize="10px"
                                                fontWeight="medium"
                                                color={selected ? 'primary' : 'overlay.400'}
                                                bg={selected ? 'rgba(28, 161, 241, 0.12)' : 'overlay.50'}
                                                px={2}
                                                py="1px"
                                                borderRadius="full"
                                            >
                                                {opt.sublabel}
                                            </Text>
                                        </Flex>
                                        <Text color="overlay.500" fontSize="xs" noOfLines={2}>
                                            {opt.description}
                                        </Text>
                                    </Box>
                                </Flex>
                            );
                        })}
                    </VStack>
                </Box>
            </Box>

            {/* Muted tags — hides any post, snap, or comment carrying one of
                these hashtags from feeds. Local-only, same as Interests below,
                since there's no Hive-native "muted tag" primitive to sync it
                against (unlike muted accounts, which ride the follow API). */}
            <Box
                bg="surface"
                borderRadius="16px"
                border="1px solid"
                borderColor="surfaceBorder"
                backdropFilter="blur(18px)"
                overflow="hidden"
                mt={6}
            >
                <Box px={6} py={4}>
                    <Text fontSize="xs" fontWeight="semibold" color="overlay.500" textTransform="uppercase" letterSpacing="0.08em">
                        Content Filters
                    </Text>
                </Box>

                <Divider borderColor="surfaceBorder" />

                <Box px={6} py={5}>
                    <Flex align="center" gap={4} mb={4}>
                        <Flex
                            flexShrink={0}
                            w="36px"
                            h="36px"
                            borderRadius="10px"
                            bg="rgba(28, 161, 241, 0.15)"
                            align="center"
                            justify="center"
                        >
                            <Icon as={FiEyeOff} boxSize={4} color="primary" />
                        </Flex>
                        <Box flex={1}>
                            <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                                Hide game results, apps and hashtags
                            </Text>
                            <Text color="overlay.500" fontSize="xs">
                                Applies to snaps, waves, comments and blog posts. When you&apos;re logged in, it follows you to every device.
                            </Text>
                        </Box>
                    </Flex>

                    <ContentFiltersSettings />
                </Box>
            </Box>

            {showInterestsSection && (
                <Box
                    bg="surface"
                    borderRadius="16px"
                    border="1px solid"
                    borderColor="surfaceBorder"
                    backdropFilter="blur(18px)"
                    overflow="hidden"
                    mt={6}
                >
                    <Box px={6} py={4}>
                        <Text fontSize="xs" fontWeight="semibold" color="overlay.500" textTransform="uppercase" letterSpacing="0.08em">
                            Discovery
                        </Text>
                    </Box>

                    <Divider borderColor="surfaceBorder" />

                    <Box px={6} py={5}>
                        <Flex align="center" gap={4} mb={4}>
                            <Flex
                                flexShrink={0}
                                w="36px"
                                h="36px"
                                borderRadius="10px"
                                bg="rgba(28, 161, 241, 0.15)"
                                align="center"
                                justify="center"
                            >
                                <Icon as={FiCompass} boxSize={4} color="primary" />
                            </Flex>
                            <Box flex={1}>
                                <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                                    Your interests
                                </Text>
                                <Text color="overlay.500" fontSize="xs">
                                    Drives what &quot;For You&quot; surfaces from outside the Snapie community.
                                </Text>
                            </Box>
                        </Flex>

                        {selectedTopicLabels.length > 0 ? (
                            <Wrap spacing={2} mb={4}>
                                {selectedTopicLabels.map(topic => (
                                    <WrapItem key={topic.label}>
                                        <Tag
                                            size="md"
                                            borderRadius="full"
                                            px={3}
                                            py={1}
                                            bg="rgba(28, 161, 241, 0.08)"
                                            color="text"
                                            border="1px solid"
                                            borderColor="rgba(28, 161, 241, 0.3)"
                                        >
                                            {topic.label}
                                        </Tag>
                                    </WrapItem>
                                ))}
                            </Wrap>
                        ) : (
                            <Text color="overlay.500" fontSize="xs" mb={4}>
                                No interests selected yet — &quot;For You&quot; is showing Snapie-community trending content instead.
                            </Text>
                        )}

                        <Button size="sm" variant="outline" onClick={() => setIsInterestPickerOpen(true)}>
                            {selectedTopicLabels.length > 0 ? 'Edit interests' : 'Choose interests'}
                        </Button>
                    </Box>
                </Box>
            )}

            {showPointsSection && (
                <Box
                    bg="surface"
                    borderRadius="16px"
                    border="1px solid"
                    borderColor="surfaceBorder"
                    backdropFilter="blur(18px)"
                    overflow="hidden"
                    mt={6}
                >
                    <Box px={6} py={4}>
                        <Text fontSize="xs" fontWeight="semibold" color="overlay.500" textTransform="uppercase" letterSpacing="0.08em">
                            Snapie Points
                        </Text>
                    </Box>

                    <Divider borderColor="surfaceBorder" />

                    <Flex align="center" gap={4} px={6} py={5}>
                        <Flex
                            flexShrink={0}
                            w="36px"
                            h="36px"
                            borderRadius="10px"
                            bg="rgba(28, 161, 241, 0.15)"
                            align="center"
                            justify="center"
                        >
                            <Icon as={FiAward} boxSize={4} color="primary" />
                        </Flex>
                        <Box flex={1}>
                            <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                                Your balance
                            </Text>
                            <Text color="overlay.500" fontSize="xs">
                                Earn points for posting, snapping, commenting, reblogging, and voting.
                            </Text>
                        </Box>
                        <Box textAlign="right" flexShrink={0}>
                            <Text color="text" fontWeight="bold" fontSize="xl" lineHeight="1">
                                {points ? points.balance.toLocaleString() : '—'}
                            </Text>
                            <Text color="overlay.500" fontSize="xs">points</Text>
                        </Box>
                    </Flex>

                    <Divider borderColor="surfaceBorder" />

                    <Flex
                        as={NextLink}
                        href="/settings/points/buy"
                        align="center"
                        gap={4}
                        px={6}
                        py={5}
                        cursor="pointer"
                        transition="all 0.15s"
                        _hover={{ bg: 'rgba(28, 161, 241, 0.06)' }}
                    >
                        <Flex
                            flexShrink={0}
                            w="36px"
                            h="36px"
                            borderRadius="10px"
                            bg="rgba(28, 161, 241, 0.15)"
                            align="center"
                            justify="center"
                        >
                            <Icon as={FiShoppingCart} boxSize={4} color="primary" />
                        </Flex>
                        <Box flex={1}>
                            <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                                Buy Points
                            </Text>
                            <Text color="overlay.500" fontSize="xs">
                                Top up with HBD — spend points on things to come.
                            </Text>
                        </Box>
                        <Icon as={FiChevronRight} boxSize={5} color="overlay.400" flexShrink={0} />
                    </Flex>

                    <Divider borderColor="surfaceBorder" />

                    <Flex
                        as={NextLink}
                        href="/settings/points/badges"
                        align="center"
                        gap={4}
                        px={6}
                        py={5}
                        cursor="pointer"
                        transition="all 0.15s"
                        _hover={{ bg: 'rgba(28, 161, 241, 0.06)' }}
                    >
                        <Flex
                            flexShrink={0}
                            w="36px"
                            h="36px"
                            borderRadius="10px"
                            bg="rgba(28, 161, 241, 0.15)"
                            align="center"
                            justify="center"
                        >
                            <Icon as={FiSmile} boxSize={4} color="primary" />
                        </Flex>
                        <Box flex={1}>
                            <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                                Mood Badges
                            </Text>
                            <Text color="overlay.500" fontSize="xs">
                                Spend points on a badge that shows next to your avatar.
                            </Text>
                        </Box>
                        <Icon as={FiChevronRight} boxSize={5} color="overlay.400" flexShrink={0} />
                    </Flex>

                    {showItemMarket && (
                        <>
                            <Divider borderColor="surfaceBorder" />

                            <Flex
                                as={NextLink}
                                href="/settings/points/market"
                                align="center"
                                gap={4}
                                px={6}
                                py={5}
                                cursor="pointer"
                                transition="all 0.15s"
                                _hover={{ bg: 'rgba(28, 161, 241, 0.06)' }}
                            >
                                <Flex
                                    flexShrink={0}
                                    w="36px"
                                    h="36px"
                                    borderRadius="10px"
                                    bg="rgba(28, 161, 241, 0.15)"
                                    align="center"
                                    justify="center"
                                >
                                    <Icon as={FiPackage} boxSize={4} color="primary" />
                                </Flex>
                                <Box flex={1}>
                                    <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                                        The Pile
                                    </Text>
                                    <Text color="overlay.500" fontSize="xs">
                                        Buy silly things with points, then throw them at posts and Snaps.
                                    </Text>
                                </Box>
                                <Icon as={FiChevronRight} boxSize={5} color="overlay.400" flexShrink={0} />
                            </Flex>
                        </>
                    )}

                    {showRoulette && (
                        <>
                            <Divider borderColor="surfaceBorder" />

                            <Flex
                                as={NextLink}
                                href="/settings/points/roulette"
                                align="center"
                                gap={4}
                                px={6}
                                py={5}
                                cursor="pointer"
                                transition="all 0.15s"
                                _hover={{ bg: 'rgba(28, 161, 241, 0.06)' }}
                            >
                                <Flex
                                    flexShrink={0}
                                    w="36px"
                                    h="36px"
                                    borderRadius="10px"
                                    bg="rgba(28, 161, 241, 0.15)"
                                    align="center"
                                    justify="center"
                                >
                                    <Icon as={FiTarget} boxSize={4} color="primary" />
                                </Flex>
                                <Box flex={1}>
                                    <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                                        Points Roulette
                                    </Text>
                                    <Text color="overlay.500" fontSize="xs">
                                        Burn points for a shot at 2x, 3x, or a rare 5x jackpot.
                                    </Text>
                                </Box>
                                <Icon as={FiChevronRight} boxSize={5} color="overlay.400" flexShrink={0} />
                            </Flex>
                        </>
                    )}
                </Box>
            )}

            {/* Governance — witness & proposal voting, tucked away here rather
                than in main nav since only a small slice of users care. */}
            <Box
                bg="surface"
                borderRadius="16px"
                border="1px solid"
                borderColor="surfaceBorder"
                backdropFilter="blur(18px)"
                overflow="hidden"
                mt={6}
            >
                <Box px={6} py={4}>
                    <Text fontSize="xs" fontWeight="semibold" color="overlay.500" textTransform="uppercase" letterSpacing="0.08em">
                        Governance
                    </Text>
                </Box>

                <Divider borderColor="surfaceBorder" />

                <Flex
                    as={NextLink}
                    href="/settings/witnesses"
                    align="center"
                    gap={4}
                    px={6}
                    py={5}
                    cursor="pointer"
                    transition="all 0.15s"
                    _hover={{ bg: 'rgba(28, 161, 241, 0.06)' }}
                >
                    <Flex
                        flexShrink={0}
                        w="36px"
                        h="36px"
                        borderRadius="10px"
                        bg="rgba(28, 161, 241, 0.15)"
                        align="center"
                        justify="center"
                    >
                        <Icon as={FiCheckSquare} boxSize={4} color="primary" />
                    </Flex>
                    <Box flex={1}>
                        <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                            Witness Voting
                        </Text>
                        <Text color="overlay.500" fontSize="xs">
                            Approve the witnesses that run the Hive blockchain.
                        </Text>
                    </Box>
                    <Icon as={FiChevronRight} boxSize={5} color="overlay.400" flexShrink={0} />
                </Flex>

                <Divider borderColor="surfaceBorder" />

                <Flex
                    as={NextLink}
                    href="/settings/proposals"
                    align="center"
                    gap={4}
                    px={6}
                    py={5}
                    cursor="pointer"
                    transition="all 0.15s"
                    _hover={{ bg: 'rgba(28, 161, 241, 0.06)' }}
                >
                    <Flex
                        flexShrink={0}
                        w="36px"
                        h="36px"
                        borderRadius="10px"
                        bg="rgba(28, 161, 241, 0.15)"
                        align="center"
                        justify="center"
                    >
                        <Icon as={FiFileText} boxSize={4} color="primary" />
                    </Flex>
                    <Box flex={1}>
                        <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                            Proposal Voting
                        </Text>
                        <Text color="overlay.500" fontSize="xs">
                            Vote on Decentralized Hive Fund proposals.
                        </Text>
                    </Box>
                    <Icon as={FiChevronRight} boxSize={5} color="overlay.400" flexShrink={0} />
                </Flex>
            </Box>

            <Box
                bg="surface"
                borderRadius="16px"
                border="1px solid"
                borderColor="surfaceBorder"
                backdropFilter="blur(18px)"
                overflow="hidden"
                mt={6}
            >
                <Box px={6} py={4}>
                    <Text fontSize="xs" fontWeight="semibold" color="overlay.500" textTransform="uppercase" letterSpacing="0.08em">
                        Feedback
                    </Text>
                </Box>

                <Divider borderColor="surfaceBorder" />

                <Box px={6} py={5}>
                    <Flex align="center" gap={4} mb={4}>
                        <Flex
                            flexShrink={0}
                            w="36px"
                            h="36px"
                            borderRadius="10px"
                            bg="rgba(28, 161, 241, 0.15)"
                            align="center"
                            justify="center"
                        >
                            <Icon as={FiMessageCircle} boxSize={4} color="primary" />
                        </Flex>
                        <Box flex={1}>
                            <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                                Send feedback
                            </Text>
                            <Text color="overlay.500" fontSize="xs">
                                Bugs, ideas, or anything that felt off. Signed-in Hive accounts are noted on the report. Guests can send one too.
                            </Text>
                        </Box>
                    </Flex>
                    <Button size="sm" variant="outline" onClick={() => setIsFeedbackOpen(true)}>
                        Send feedback
                    </Button>
                </Box>
            </Box>

            {/* What's new / changelog */}
            <Box
                bg="surface"
                borderRadius="16px"
                border="1px solid"
                borderColor="surfaceBorder"
                backdropFilter="blur(18px)"
                overflow="hidden"
                mt={6}
            >
                <Box px={6} py={4}>
                    <Text fontSize="xs" fontWeight="semibold" color="overlay.500" textTransform="uppercase" letterSpacing="0.08em">
                        About
                    </Text>
                </Box>

                <Divider borderColor="surfaceBorder" />

                <Flex
                    as={NextLink}
                    href="/changelog"
                    align="center"
                    gap={4}
                    px={6}
                    py={5}
                    cursor="pointer"
                    transition="all 0.15s"
                    _hover={{ bg: 'rgba(28, 161, 241, 0.06)' }}
                >
                    <Flex
                        flexShrink={0}
                        w="36px"
                        h="36px"
                        borderRadius="10px"
                        bg="rgba(28, 161, 241, 0.15)"
                        align="center"
                        justify="center"
                    >
                        <Icon as={FiGift} boxSize={4} color="primary" />
                    </Flex>
                    <Box flex={1}>
                        <Text color="text" fontWeight="medium" fontSize="sm" mb={1}>
                            What&apos;s new
                        </Text>
                        <Text color="overlay.500" fontSize="xs">
                            See everything we&apos;ve shipped recently.
                        </Text>
                    </Box>
                    <Icon as={FiChevronRight} boxSize={5} color="overlay.400" flexShrink={0} />
                </Flex>
            </Box>

            {isInterestPickerOpen && (
                <InterestPicker mode="edit" onDone={() => setIsInterestPickerOpen(false)} />
            )}
            <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
        </Box>
    );
}
