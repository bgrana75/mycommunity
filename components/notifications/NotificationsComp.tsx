'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar as ChakraAvatar,
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Notifications } from '@hiveio/dhive';
import { useRouter } from 'next/navigation';
import {
  FiAtSign,
  FiBell,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiMessageCircle,
  FiRefreshCw,
  FiRepeat,
  FiSend,
  FiThumbsUp,
  FiUserPlus,
} from 'react-icons/fi';
import { IconType } from 'react-icons';
import { useHiveNotifications } from '@/hooks/useHiveNotifications';
import {
  formatNotificationTime,
  getNotificationActor,
  getNotificationPostKey,
  getNotificationRoute,
  getNotificationTypeLabel,
  NOTIFICATION_CATEGORIES,
  NotificationFilter,
  parseHiveDate,
} from '@/lib/utils/notificationHelpers';
import { groupNotifications, NotificationGroup } from '@/lib/utils/notificationGrouping';
import { getHiveAvatarUrl } from '@/lib/utils/avatarUtils';
import { Avatar } from '@/components/shared/Avatar';
import { MoodBadgeIcon } from '@/components/shared/MoodBadgeIcon';
import { useMoodBadges } from '@/hooks/useMoodBadges';
import { useNotificationContext } from '@/hooks/useNotificationContext';

interface NotificationCompProps {
  username: string
}

type BucketKey = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'older';

interface ActivitySummary {
  total: number;
  votes: number;
  uniqueVoters: number;
  totalEarnings: number;
  replies: number;
  mentions: number;
  follows: number;
  reblogs: number;
  transfers: number;
}

const BUCKET_LABELS: Record<BucketKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  this_month: 'This Month',
  older: 'Older',
};

const BUCKET_ORDER: BucketKey[] = ['today', 'yesterday', 'this_week', 'this_month', 'older'];
const CATEGORY_ENTRIES = Object.entries(NOTIFICATION_CATEGORIES) as Array<[
  Exclude<NotificationFilter, 'unread'>,
  { label: string; types: readonly string[] | null },
]>;
const MAX_STACKED_AVATARS = 5;

function getTimeBucket(dateString: string): BucketKey {
  const date = parseHiveDate(dateString);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart);
  monthStart.setMonth(monthStart.getMonth() - 1);

  if (date >= todayStart) return 'today';
  if (date >= yesterdayStart) return 'yesterday';
  if (date >= weekStart) return 'this_week';
  if (date >= monthStart) return 'this_month';
  return 'older';
}

function bucketize(groups: NotificationGroup[]) {
  return groups.reduce<Record<BucketKey, NotificationGroup[]>>((buckets, group) => {
    buckets[getTimeBucket(group.date)].push(group);
    return buckets;
  }, {
    today: [],
    yesterday: [],
    this_week: [],
    this_month: [],
    older: [],
  });
}

function computeSummary(notifications: Notifications[]): ActivitySummary {
  const votes = notifications.filter((n) => n.type === 'vote');
  const uniqueVoters = new Set(votes.map(getNotificationActor).filter(Boolean));
  const totalEarnings = votes.reduce((sum, n) => {
    const match = n.msg?.match(/\(\$([0-9]+(?:\.[0-9]+)?)\)/);
    return sum + (match ? parseFloat(match[1]) : 0);
  }, 0);

  return {
    total: notifications.length,
    votes: votes.length,
    uniqueVoters: uniqueVoters.size,
    totalEarnings: Math.round(totalEarnings * 1000) / 1000,
    replies: notifications.filter((n) => ['reply', 'reply_comment'].includes(n.type)).length,
    mentions: notifications.filter((n) => n.type === 'mention').length,
    follows: notifications.filter((n) => n.type === 'follow').length,
    reblogs: notifications.filter((n) => n.type === 'reblog').length,
    transfers: notifications.filter((n) => n.type === 'transfer').length,
  };
}

function getSummaryItems(summary: ActivitySummary) {
  return [
    summary.votes > 0 && {
      key: 'votes',
      icon: FiThumbsUp,
      value: summary.votes,
      label: 'Votes',
      detail: `${summary.uniqueVoters} voter${summary.uniqueVoters === 1 ? '' : 's'}`,
      sub: summary.totalEarnings > 0 ? `$${summary.totalEarnings.toFixed(2)}` : null,
      filter: 'votes' as NotificationFilter,
      color: 'green',
    },
    summary.replies > 0 && {
      key: 'replies',
      icon: FiMessageCircle,
      value: summary.replies,
      label: 'Replies',
      filter: 'replies' as NotificationFilter,
      color: 'blue',
    },
    summary.follows > 0 && {
      key: 'follows',
      icon: FiUserPlus,
      value: summary.follows,
      label: 'New Followers',
      filter: 'follows' as NotificationFilter,
      color: 'purple',
    },
    summary.mentions > 0 && {
      key: 'mentions',
      icon: FiAtSign,
      value: summary.mentions,
      label: 'Mentions',
      filter: 'mentions' as NotificationFilter,
      color: 'orange',
    },
    summary.reblogs > 0 && {
      key: 'reblogs',
      icon: FiRepeat,
      value: summary.reblogs,
      label: 'Reblogs',
      filter: 'reblogs' as NotificationFilter,
      color: 'cyan',
    },
    summary.transfers > 0 && {
      key: 'transfers',
      icon: FiSend,
      value: summary.transfers,
      label: 'Transfers',
      filter: 'transfers' as NotificationFilter,
      color: 'pink',
    },
  ].filter(Boolean) as Array<{
    key: string;
    icon: IconType;
    value: number;
    label: string;
    detail?: string;
    sub?: string | null;
    filter: NotificationFilter;
    color: string;
  }>;
}

export default function NotificationsComp({ username }: NotificationCompProps) {
  const { username: user } = useCurrentUser();
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [summaryRange, setSummaryRange] = useState<'today' | 'week' | 'month'>('week');
  const canViewNotifications = Boolean(user && user === username);

  const {
    notifications,
    loading,
    loadingMore,
    hasMore,
    error,
    refetch,
    loadMore,
    unreadCount,
    markAllAsRead,
    markingAsRead,
    isUnread,
  } = useHiveNotifications(canViewNotifications ? username : null, { limit: 50, poll: false });

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(isUnread);
    const allowedTypes = NOTIFICATION_CATEGORIES[filter].types as readonly string[] | null;
    return allowedTypes
      ? notifications.filter((n) => allowedTypes.includes(n.type))
      : notifications;
  }, [filter, isUnread, notifications]);

  const grouped = useMemo(() => groupNotifications(filtered), [filtered]);
  const bucketed = useMemo(() => bucketize(grouped), [grouped]);
  const notificationContext = useNotificationContext(filtered);

  const summary = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    if (summaryRange === 'today') cutoff.setHours(0, 0, 0, 0);
    else if (summaryRange === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - 1);
    return computeSummary(notifications.filter((n) => parseHiveDate(n.date) >= cutoff));
  }, [notifications, summaryRange]);

  // The list is paginated (50 at a time) and only grows when the user scrolls or
  // clicks "Load more". Selecting a wider Activity range (week/month) needs pages
  // reaching back that far, so fetch older pages until we cover the range or run out.
  const rangeLoadAttemptsRef = useRef(0);
  useEffect(() => {
    rangeLoadAttemptsRef.current = 0;
  }, [summaryRange]);

  useEffect(() => {
    if (summaryRange === 'today') return;
    if (loadingMore || !hasMore) return;
    if (notifications.length === 0) return;
    if (rangeLoadAttemptsRef.current >= 20) return;

    const cutoff = new Date();
    if (summaryRange === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - 1);

    const oldestLoaded = notifications[notifications.length - 1];
    if (parseHiveDate(oldestLoaded.date) >= cutoff) {
      rangeLoadAttemptsRef.current += 1;
      loadMore();
    }
  }, [summaryRange, notifications, hasMore, loadingMore, loadMore]);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      toast({ title: 'Notifications marked as read', status: 'success', duration: 2500 });
    } catch {
      toast({ title: 'Could not mark notifications as read', status: 'error', duration: 3500 });
    }
  };

  const handleNotificationClick = (notification: Notifications) => {
    const route = getNotificationRoute(notification);
    if (route) router.push(route);
  };

  if (!canViewNotifications) {
    return (
      <Box p={4} w="full">
        <EmptyState title="Please log in to view your notifications." />
      </Box>
    );
  }

  return (
    <Box p={{ base: 3, md: 6 }} w="full" maxW="980px" mx="auto">

      {/* Header */}
      <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={3} mb={5} flexWrap="wrap">
        <HStack spacing={4} align="start">
          <Flex
            w={12} h={12}
            borderRadius="full"
            bg="rgba(28, 161, 241, 0.1)"
            border="1px solid"
            borderColor="rgba(28, 161, 241, 0.2)"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
            mt={0.5}
          >
            <Icon as={FiBell} color="primary" boxSize={5} />
          </Flex>
          <Box>
            <HStack spacing={3}>
              <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="bold">
                Notifications
              </Text>
              {unreadCount > 0 && (
                <Badge colorScheme="red" borderRadius="full" px={3} py={1}>
                  {unreadCount} new
                </Badge>
              )}
            </HStack>
            <Text fontSize="sm" color="text" opacity={0.6}>
              Grouped activity from Hive, routed back into Snapie.
            </Text>
          </Box>
        </HStack>

        <HStack>
          {unreadCount > 0 && (
            <Button
              leftIcon={<Icon as={FiCheckCircle} />}
              size="sm"
              aria-label="Mark all notifications as read"
              onClick={handleMarkAllAsRead}
              isLoading={markingAsRead}
            >
              Mark all read
            </Button>
          )}
          <IconButton
            aria-label="Refresh notifications"
            icon={<Icon as={FiRefreshCw} />}
            size="sm"
            onClick={refetch}
            isLoading={loading}
          />
        </HStack>
      </Flex>

      {/* Filter Pills */}
      <HStack
        spacing={2}
        overflowX="auto"
        pb={2}
        mb={5}
        sx={{ '::-webkit-scrollbar': { display: 'none' } }}
      >
        {CATEGORY_ENTRIES.map(([key, category]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? 'solid' : 'ghost'}
            onClick={() => setFilter(key)}
            flexShrink={0}
            borderRadius="full"
          >
            {category.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={filter === 'unread' ? 'solid' : 'ghost'}
          colorScheme="red"
          onClick={() => setFilter('unread')}
          flexShrink={0}
          borderRadius="full"
        >
          Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
        </Button>
      </HStack>

      <ActivitySummaryCard
        summary={summary}
        range={summaryRange}
        onRangeChange={setSummaryRange}
        onFilter={setFilter}
        isBackfilling={summaryRange !== 'today' && loadingMore}
      />

      {Boolean(error) && (
        <Box bg="red.500" color="white" borderRadius="base" p={3} mb={4}>
          Could not load notifications. <Button size="xs" ml={2} onClick={refetch}>Retry</Button>
        </Box>
      )}

      {loading && filtered.length === 0 ? (
        <Flex justify="center" py={12}>
          <Spinner size="lg" />
        </Flex>
      ) : grouped.length > 0 ? (
        <Stack spacing={6}>
          {BUCKET_ORDER.map((bucket) => {
            const items = bucketed[bucket];
            if (!items.length) return null;

            return (
              <Box key={bucket}>
                <Flex align="center" gap={3} mb={3}>
                  <Text fontSize="xs" fontWeight="bold" textTransform="uppercase" letterSpacing="widest" opacity={0.6} flexShrink={0}>
                    {BUCKET_LABELS[bucket]}
                  </Text>
                  <Box flex={1} h="1px" bg="border" />
                </Flex>
                <Stack spacing={3}>
                  {items.map((group) => (
                    <NotificationRow
                      key={group.id}
                      group={group}
                      isUnread={isUnread}
                      onClick={handleNotificationClick}
                      contextById={notificationContext}
                    />
                  ))}
                </Stack>
              </Box>
            );
          })}
          {hasMore && (
            <Button onClick={loadMore} isLoading={loadingMore} alignSelf="center" variant="outline">
              Load more
            </Button>
          )}
        </Stack>
      ) : (
        <EmptyState
          title={
            filter === 'all'
              ? 'You have no notifications yet.'
              : filter === 'unread'
                ? 'No unread notifications.'
                : `No ${NOTIFICATION_CATEGORIES[filter].label.toLowerCase()} yet.`
          }
        />
      )}
    </Box>
  );
}

function ActivitySummaryCard({
  summary,
  range,
  onRangeChange,
  onFilter,
  isBackfilling,
}: {
  summary: ActivitySummary;
  range: 'today' | 'week' | 'month';
  onRangeChange: (range: 'today' | 'week' | 'month') => void;
  onFilter: (filter: NotificationFilter) => void;
  isBackfilling?: boolean;
}) {
  const summaryItems = getSummaryItems(summary);

  return (
    <Box bg="muted" border="tb1" borderRadius="10px" p={5} mb={5}>
      <Flex justify="space-between" align="center" gap={3} mb={5} flexWrap="wrap">
        <HStack spacing={2}>
          <Flex w={7} h={7} borderRadius="full" bg="rgba(28, 161, 241, 0.12)" border="1px solid" borderColor="rgba(28, 161, 241, 0.2)" alignItems="center" justifyContent="center">
            <Icon as={FiBell} color="primary" boxSize={3.5} />
          </Flex>
          <Text fontWeight="bold">Activity</Text>
          {isBackfilling && <Spinner size="xs" opacity={0.6} />}
        </HStack>
        <HStack spacing={1}>
          {([['today', 'Today'], ['week', 'This Week'], ['month', 'This Month']] as const).map(([key, label]) => (
            <Button
              key={key}
              size="xs"
              variant={range === key ? 'solid' : 'ghost'}
              borderRadius="full"
              onClick={() => onRangeChange(key)}
            >
              {label}
            </Button>
          ))}
        </HStack>
      </Flex>

      {summaryItems.length > 0 ? (
        <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={3}>
          {summaryItems.map((item) => (
            <Button
              key={item.key}
              h="auto"
              py={4}
              px={3}
              variant="unstyled"
              display="flex"
              onClick={() => onFilter(item.filter)}
              borderWidth="1px"
              borderStyle="solid"
              borderColor={`${item.color}.800`}
              borderRadius="10px"
              _hover={{ borderColor: `${item.color}.600`, transform: 'translateY(-1px)', boxShadow: 'sm' }}
              transition="all 0.15s ease"
            >
              <VStack spacing={1} w="full">
                <Flex
                  w={9} h={9}
                  borderRadius="full"
                  bg={`${item.color}.900`}
                  alignItems="center"
                  justifyContent="center"
                  mb={1}
                >
                  <Icon as={item.icon} color={`${item.color}.400`} boxSize={4} />
                </Flex>
                <Text fontSize="xl" fontWeight="bold" color={`${item.color}.300`}>{item.value}</Text>
                <Text fontSize="xs" fontWeight="medium">{item.label}</Text>
                {item.sub && <Text fontSize="xs" color={`${item.color}.400`}>{item.sub}</Text>}
                {item.detail && <Text fontSize="xs" opacity={0.65}>{item.detail}</Text>}
              </VStack>
            </Button>
          ))}
        </SimpleGrid>
      ) : (
        <Text fontSize="sm" opacity={0.6}>No activity in this range yet.</Text>
      )}
    </Box>
  );
}

function NotificationRow({
  group,
  isUnread,
  onClick,
  contextById,
}: {
  group: NotificationGroup;
  isUnread: (notification: Notifications) => boolean;
  onClick: (notification: Notifications) => void;
  contextById: Record<string, { label: string; previewText: string; parentRoute: string } | undefined>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (group.type === 'single') {
    return (
      <SingleNotificationRow
        notification={group.notification}
        unread={isUnread(group.notification)}
        onClick={() => onClick(group.notification)}
        contextPreview={contextById[group.notification.id]}
      />
    );
  }

  const hasUnread = group.items.some(isUnread);
  const topActors = group.actors.slice(0, MAX_STACKED_AVATARS);
  const remainingActors = group.actors.length - MAX_STACKED_AVATARS;
  const actorLabel = group.actors.length <= 2
    ? group.actors.map((actor) => `@${actor}`).join(' and ')
    : `@${group.actors[0]} and ${group.actors.length - 1} others`;
  const actorPrefix = actorLabel ? `${actorLabel} ` : 'Someone ';
  const label = group.notifType === 'vote'
    ? `${actorPrefix}voted on your post${group.totalValue ? ` ($${group.totalValue.toFixed(2)})` : ''}`
    : group.notifType === 'follow'
      ? `${actorPrefix}followed you`
      : `${group.items.length} ${group.notifType} notifications`;

  return (
    <Box>
      <NotificationShell
        unread={hasUnread}
        onClick={() => setExpanded((v) => !v)}
        ariaExpanded={expanded}
        ariaControls={`notif-group-${group.id}`}
      >
        <AvatarStack actors={topActors} remaining={remainingActors} />
        <Box flex="1" minW={0}>
          <Text fontWeight="semibold">{label}</Text>
          <HStack fontSize="sm" opacity={0.72} spacing={2}>
            <Text>{group.items.length} {group.notifType}{group.items.length === 1 ? '' : 's'}</Text>
            <Text>·</Text>
            <Text>{formatNotificationTime(group.date)}</Text>
            <HStack spacing={1}>
              <Icon as={expanded ? FiChevronDown : FiChevronRight} />
              <Text>{expanded ? 'collapse' : 'expand'}</Text>
            </HStack>
          </HStack>
        </Box>
      </NotificationShell>
      {expanded && (
        <Stack id={`notif-group-${group.id}`} spacing={2} mt={2} pl={{ base: 3, md: 10 }}>
          {group.items.map((notification) => (
            <SingleNotificationRow
              key={notification.id}
              notification={notification}
              unread={isUnread(notification)}
              onClick={() => onClick(notification)}
              nested
              contextPreview={contextById[notification.id]}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function SingleNotificationRow({
  notification,
  unread,
  onClick,
  nested = false,
  contextPreview,
}: {
  notification: Notifications;
  unread: boolean;
  onClick: () => void;
  nested?: boolean;
  contextPreview?: { label: string; previewText: string; parentRoute: string };
}) {
  const actor = getNotificationActor(notification);
  const postKey = getNotificationPostKey(notification);
  const permlink = postKey ? postKey.split('/')[1] : null;
  const readableTitle = permlink ? permlink.replace(/-/g, ' ') : null;
  const { getEquippedBadge } = useMoodBadges();

  return (
    <NotificationShell unread={unread} onClick={onClick} nested={nested}>
      {actor ? (
        <Avatar
          size="sm"
          username={actor}
          overlay={
            getEquippedBadge(actor)
              ? <MoodBadgeIcon sku={getEquippedBadge(actor)!} username={actor} size="16px" />
              : undefined
          }
        />
      ) : <ChakraAvatar size="sm" />}
      <Box flex="1" minW={0}>
        <Text fontWeight="semibold">{notification.msg || getNotificationTypeLabel(notification.type)}</Text>
        <HStack fontSize="sm" opacity={0.72} spacing={2} flexWrap="wrap">
          <Text>{getNotificationTypeLabel(notification.type)}</Text>
          <Text>·</Text>
          <Text>{formatNotificationTime(notification.date)}</Text>
          {readableTitle && (
            <>
              <Text>·</Text>
              <Text isTruncated maxW="160px" opacity={0.8} fontStyle="italic">{readableTitle}</Text>
            </>
          )}
        </HStack>
        {contextPreview && (
          <Text mt={1} fontSize="sm" opacity={0.86} noOfLines={2}>
            <Text as="span" fontWeight="semibold">{contextPreview.label}: </Text>
            <Text
              as="a"
              href={contextPreview.parentRoute}
              onClick={(event) => event.stopPropagation()}
              color="primary"
              textDecoration="underline"
              _hover={{ opacity: 0.9 }}
            >
              {`"${contextPreview.previewText}"`}
            </Text>
          </Text>
        )}
      </Box>
    </NotificationShell>
  );
}

function NotificationShell({
  children,
  unread,
  onClick,
  nested = false,
  ariaExpanded,
  ariaControls,
}: {
  children: ReactNode;
  unread: boolean;
  onClick: () => void;
  nested?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
}) {
  return (
    <HStack
      as="button"
      type="button"
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      textAlign="left"
      w="full"
      spacing={3}
      p={nested ? 3 : 4}
      bg="muted"
      color="text"
      borderRadius="base"
      align="center"
      position="relative"
      _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
      transition="all 0.15s ease"
      onClick={onClick}
      sx={{
        border: '1px solid rgba(28, 161, 241, 0.18)',
        ...(unread && {
          borderLeftWidth: '3px',
          borderLeftColor: 'var(--chakra-colors-primary)',
          backgroundColor: 'var(--chakra-colors-muted)',
          backgroundImage:
            'linear-gradient(90deg, rgba(28, 161, 241, 0.12) 0%, rgba(28, 161, 241, 0.04) 42%, transparent 72%)',
        }),
      }}
    >
      {children}
    </HStack>
  );
}

// Intentionally raw Chakra Avatar, not the shared Avatar component — the
// overlapping stack uses manual negative margin + a border ring, which a
// wrapper component's own layout box would interfere with.
function AvatarStack({ actors, remaining }: { actors: string[]; remaining: number }) {
  return (
    <HStack spacing={0} minW={`${Math.min(actors.length, MAX_STACKED_AVATARS) * 22 + (remaining > 0 ? 28 : 0)}px`}>
      {actors.map((actor, index) => (
        <ChakraAvatar
          key={actor}
          size="sm"
          src={getHiveAvatarUrl(actor, 'small')}
          name={actor}
          ml={index === 0 ? 0 : '-10px'}
          border="2px solid"
          borderColor="muted"
        />
      ))}
      {remaining > 0 && (
        <Flex
          ml="-10px"
          boxSize="32px"
          borderRadius="full"
          align="center"
          justify="center"
          bg="background"
          border="2px solid"
          borderColor="muted"
          fontSize="xs"
          fontWeight="bold"
        >
          +{remaining}
        </Flex>
      )}
    </HStack>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <Box bg="muted" border="tb1" borderRadius="10px" p={12} textAlign="center">
      <Flex
        w={16} h={16}
        borderRadius="full"
        bg="rgba(28, 161, 241, 0.08)"
        border="1px solid"
        borderColor="rgba(28, 161, 241, 0.15)"
        alignItems="center"
        justifyContent="center"
        mx="auto"
        mb={4}
      >
        <Icon as={FiBell} boxSize={7} opacity={0.5} />
      </Flex>
      <Text fontWeight="semibold" fontSize="lg" mb={1}>{title}</Text>
      <Text fontSize="sm" opacity={0.5}>Check back later for updates.</Text>
    </Box>
  );
}
