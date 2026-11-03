'use client';

import {
  Avatar as ChakraAvatar,
  AvatarGroup,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  Icon,
  IconButton,
  Image,
  Input,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Spinner,
  Text,
  Tooltip,
  VStack,
  useBreakpointValue,
  useDisclosure,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useState, useEffect, useRef, useCallback, useMemo, KeyboardEvent, MouseEvent as ReactMouseEvent, SyntheticEvent } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { signMessageWithAioha } from '@/lib/hive/aioha';
import { FiArrowDown, FiArrowLeft, FiArrowUp, FiChevronDown, FiCornerUpLeft, FiExternalLink, FiHash, FiImage, FiMaximize2, FiMessageSquare, FiMinus, FiPlus, FiSend, FiUsers, FiX } from 'react-icons/fi';
import { FaPlay } from 'react-icons/fa';
import { KeyTypes } from '@/lib/aioha/enums';
import { chatService, Channel, Conversation, DmStatusInfo, Message } from '@/lib/chat/ChatService';
import { shouldShowChatAuthGate } from '@/lib/chat/authGate';
// Same parser the server uses to decide what mentions you, so highlighting and
// the badge can never disagree about what counts as a mention.
import { MENTION_REGEX, normalizeMentionToken, messageMentionsUser, getActiveMentionDraft } from '@/lib/chat/mentions';
import {
  CHAT_LIST_INDEX_ORIGIN,
  absoluteMessageIndex,
  nextFirstItemIndex,
  pinAfterAtBottom,
  shouldBackfillShortThread,
  shouldPageOlderHistory,
  type ChatScrollPin,
} from '@/lib/chat/messageScroll';
import { formatDaySeparatorLabel, messageIdsWithDaySeparator } from '@/lib/chat/daySeparators';
import { getFCMToken, onForegroundMessage } from '@/lib/chat/fcmClient';
import { getHiveAvatarUrl } from '@/lib/utils/avatarUtils';
import { Avatar } from '@/components/shared/Avatar';
import { MoodBadgeIcon } from '@/components/shared/MoodBadgeIcon';
import { useMoodBadges } from '@/hooks/useMoodBadges';
import { transferEncryptedMemoWithAioha } from '@/lib/hive/aioha';
import GiphySelector from '@/components/homepage/GiphySelector';
import type { IGif } from '@giphy/js-types';
import { playNotificationChime as playChime } from '@/lib/utils/notificationChime';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  onRestore?: () => void;
  onPopout?: () => void;
  isPopoutWindow?: boolean;
  /** Server-recomputed badge total, pushed up whenever this panel marks a
   *  conversation read so the sidebar clears without waiting for its poll. */
  onUnreadChange?: (total: number) => void;
}

const POLL_INTERVAL = 15000;
const QUICK_EMOJIS = ['😀', '😂', '❤️', '🔥', '👏', '👍', '🙏', '🎉', '😮', '😢'];
const fadeIn = keyframes`from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); }`;
const CHAT_PANEL_SIZE_KEY = 'snapie-chat-panel-size';
const CHAT_PANEL_RESIZE_HINT_KEY = 'snapie-chat-resize-hint-dismissed';
const DESKTOP_PANEL_DEFAULT = { width: 460, height: 680 };
const DESKTOP_PANEL_MIN = { width: 400, height: 520 };
const CHAT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const CHAT_IMAGE_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
const INITIAL_MESSAGE_LIMIT = 50;
const DELTA_MESSAGE_LIMIT = 50;
const MAX_ACTIVE_MESSAGES = 600;

const IMAGE_HOSTS = new Set(['images.hive.blog', 'images.3speak.tv', 'files.peakd.com']);

// ── Short preview ─────────────────────────────────────────────────────────────

type ShortMeta = { thumbnailUrl: string; title: string; author: string };
const shortMetaCache = new Map<string, ShortMeta | null>();

function extractShortsV(content: string): string | null {
  const match = content.match(/\/shorts[?]v=([^\s&"']+)/);
  return match ? match[1] : null;
}

function ShortPreview({ v }: { v: string }) {
  const [meta, setMeta] = useState<ShortMeta | null | 'loading'>(() => {
    const cached = shortMetaCache.get(v);
    return cached !== undefined ? cached : 'loading';
  });

  useEffect(() => {
    if (meta !== 'loading') return;
    fetch(`/api/short-meta?v=${encodeURIComponent(v)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const m: ShortMeta | null = data?.author ? data : null;
        shortMetaCache.set(v, m);
        setMeta(m);
      })
      .catch(() => { shortMetaCache.set(v, null); setMeta(null); });
  }, [v, meta]);

  if (meta === 'loading') return <Spinner size="xs" color="overlay.500" mt={1} />;
  if (!meta) return null;

  return (
    <Box
      as="a"
      href={`/shorts?v=${v}`}
      display="block"
      mt={2}
      borderRadius="10px"
      overflow="hidden"
      border="1px solid"
      borderColor="overlay.200"
      textDecoration="none"
      _hover={{ opacity: 0.85 }}
      transition="opacity 0.15s"
    >
      {meta.thumbnailUrl && (
        <Box position="relative">
          <Image src={meta.thumbnailUrl} alt={meta.title} w="100%" maxH="160px" objectFit="cover" display="block" />
          <Box position="absolute" inset="0" display="flex" alignItems="center" justifyContent="center" bg="blackAlpha.300">
            <Box bg="blackAlpha.700" borderRadius="full" p="10px" lineHeight="0">
              <FaPlay color="white" size={14} />
            </Box>
          </Box>
        </Box>
      )}
      <Box px={3} py={2} bg="blackAlpha.500">
        <Text fontSize="10px" color="overlay.600">@{meta.author} · Snapie Short</Text>
        {meta.title && <Text fontSize="sm" color="white" fontWeight="medium" noOfLines={2}>{meta.title}</Text>}
      </Box>
    </Box>
  );
}

function isImageUrl(url: string): boolean {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (IMAGE_HOSTS.has(parsed.hostname.replace(/^www\./, ''))) return true;
    const pathname = parsed.pathname.toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'].some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

function extractImageUrls(content: string): string[] {
  if (!content) return [];
  const urls = content.match(/https?:\/\/[^\s)]+/gi) || [];
  return urls.filter(isImageUrl);
}

function stripInlineImageUrls(content: string, imageUrls: string[]): string {
  if (!content || imageUrls.length === 0) return content;
  let out = content;
  for (const url of imageUrls) out = out.split(url).join('');
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function contentWithMentions(content: string, activeUsername?: string | null): Array<{ text: string; highlighted: boolean }> {
  if (!content) return [];
  const out: Array<{ text: string; highlighted: boolean }> = [];
  const target = activeUsername ? normalizeMentionToken(activeUsername) : '';
  const regex = new RegExp(MENTION_REGEX.source, 'gi');
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const mention = match[0];
    const start = match.index;
    if (start > lastIndex) {
      out.push({ text: content.slice(lastIndex, start), highlighted: false });
    }
    out.push({
      text: mention,
      highlighted: !!target && normalizeMentionToken(mention) === target,
    });
    lastIndex = start + mention.length;
  }

  if (lastIndex < content.length) {
    out.push({ text: content.slice(lastIndex), highlighted: false });
  }

  return out.length ? out : [{ text: content, highlighted: false }];
}

function MentionAwareText({ content, activeUsername }: { content: string; activeUsername?: string | null }) {
  const segments = contentWithMentions(content, activeUsername);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.highlighted ? (
          <Box
            key={`${seg.text}-${idx}`}
            as="span"
            px="1"
            borderRadius="md"
            bg="yellow.300"
            color="black"
            fontWeight="700"
          >
            {seg.text}
          </Box>
        ) : (
          <Box as="span" key={`${seg.text}-${idx}`}>
            {seg.text}
          </Box>
        )
      )}
    </>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function DaySeparator({ label }: { label: string }) {
  if (!label) return null;
  return (
    <Flex align="center" gap={3} pt={2} pb={1} role="separator" aria-label={label}>
      <Box flex="1" h="1px" bg="overlay.300" />
      <Text fontSize="xs" fontWeight="600" color="overlay.700" lineHeight="short" flexShrink={0}>
        {label}
      </Text>
      <Box flex="1" h="1px" bg="overlay.300" />
    </Flex>
  );
}

function formatLastSeen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function sortMessagesAsc(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => a._id.localeCompare(b._id));
}

function mergeMessagesById(existing: Message[], incoming: Message[], cap = MAX_ACTIVE_MESSAGES): Message[] {
  if (!incoming.length) return existing;
  const merged = new Map<string, Message>();
  for (const msg of existing) merged.set(msg._id, msg);
  for (const msg of incoming) merged.set(msg._id, msg);
  const ordered = sortMessagesAsc(Array.from(merged.values()));
  if (ordered.length <= cap) return ordered;
  return ordered.slice(ordered.length - cap);
}

function trimMessagesTail(messages: Message[], cap = MAX_ACTIVE_MESSAGES): Message[] {
  if (messages.length <= cap) return messages;
  return messages.slice(messages.length - cap);
}

function dmThreadShowsSeen(messages: Message[], user: string | null, peerSeenAt?: string | null): boolean {
  if (!user || !peerSeenAt) return false;
  const myLast = [...messages].reverse().find(message => message.sender === user);
  if (!myLast) return false;
  return new Date(peerSeenAt).getTime() >= new Date(myLast.createdAt).getTime();
}

function avatarNameForConversation(conv: Conversation): string {
  if (conv.type === 'dm') return conv.peer || conv.name.replace(/^@/, '');
  if (conv.members?.length) return conv.members[0];
  return conv.name;
}

function ConversationAvatar({ conv }: { conv: Conversation }) {
  const { getEquippedBadge } = useMoodBadges();
  if (conv.type === 'group' && conv.members && conv.members.length > 1) {
    // Intentionally raw Chakra Avatar/AvatarGroup, not the shared Avatar
    // component — AvatarGroup clones mr/size/borderColor onto its direct
    // children via cloneElement, which a wrapper component would silently
    // swallow (no stacking, no ring, no error).
    return (
      <AvatarGroup size="xs" max={2}>
        {conv.members.slice(0, 2).map(member => (
          <ChakraAvatar key={member} name={member} src={getHiveAvatarUrl(member, 'small')} />
        ))}
      </AvatarGroup>
    );
  }
  if (conv.type === 'channel') {
    return (
      <Flex
        w="28px"
        h="28px"
        borderRadius="full"
        bg="overlay.200"
        align="center"
        justify="center"
        flexShrink={0}
      >
        <Icon as={FiHash} boxSize={3} color="overlay.700" />
      </Flex>
    );
  }
  const username = avatarNameForConversation(conv);
  return (
    <Avatar
      size="xs"
      username={username}
      overlay={
        getEquippedBadge(username)
          ? <MoodBadgeIcon sku={getEquippedBadge(username)!} username={username} size="14px" />
          : undefined
      }
    />
  );
}

function ForwardButton({
  msg,
  targets,
  onForwardSelect,
}: {
  msg: Message;
  targets: Conversation[];
  onForwardSelect: (message: Message, target: Conversation) => void;
}) {
  if (!targets.length) return null;
  return (
    <Menu placement="top">
      <MenuButton
        as={Button}
        size="xs"
        variant="link"
        color="overlay.500"
        fontSize="10px"
        fontWeight="500"
        minH="unset"
        _hover={{ color: 'overlay.700' }}
      >
        Forward
      </MenuButton>
      <MenuList bg="muted" borderColor="overlay.200" maxH="240px" overflowY="auto">
        {targets.map(target => (
          <MenuItem
            key={target._id}
            bg="muted"
            color="text"
            fontSize="sm"
            _hover={{ bg: 'overlay.100' }}
            onClick={() => onForwardSelect(msg, target)}
          >
            {target.type === 'channel' ? `#${target.name}` : target.name}
          </MenuItem>
        ))}
      </MenuList>
    </Menu>
  );
}

function MessageBubble({
  msg,
  isOwn,
  onOpenDm,
  onReplySelect,
  onMentionSelect,
  replyPreview,
  onEditSelect,
  onDeleteSelect,
  forwardTargets,
  onForwardSelect,
  activeUsername,
  highlightMention,
}: {
  msg: Message;
  isOwn: boolean;
  onOpenDm?: (username: string) => void;
  onReplySelect?: (message: Message) => void;
  onMentionSelect?: (username: string) => void;
  replyPreview?: Message | null;
  onEditSelect?: (message: Message) => void;
  onDeleteSelect?: (message: Message) => void;
  forwardTargets?: Conversation[];
  onForwardSelect?: (message: Message, target: Conversation) => void;
  activeUsername?: string | null;
  highlightMention?: boolean;
}) {
  const isDeleted = msg.content === '[deleted]';
  const imageUrls = isDeleted ? [] : extractImageUrls(msg.content);
  const shortsV = isDeleted ? null : extractShortsV(msg.content);
  const textContent = (() => {
    let t = stripInlineImageUrls(msg.content, imageUrls);
    if (shortsV) t = t.replace(/https?:\/\/\S*\/shorts\?v=\S*/g, '').trim();
    return t;
  })();
  const canOpenDm = !isOwn && !!onOpenDm;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const handleReplyKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onReplySelect) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onReplySelect(msg);
    }
  };
  const handleEditKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!onEditSelect) return;
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      onEditSelect(msg);
    }
  };
  if (isOwn) {
    return (
      <Box
        animation={`${fadeIn} 0.18s ease`}
        alignSelf="flex-end"
        maxW="88%"
      >
        <Box
          bg={highlightMention ? 'purple.600' : 'blue.600'}
          px={3}
          py={2}
          borderRadius="16px 16px 4px 16px"
          border="1px solid"
          borderColor={highlightMention ? 'purple.300' : 'blue.500'}
        >
          {msg.replyTo && (
            <Box mb={2} px={2} py={1} borderRadius="8px" bg="blackAlpha.300" border="1px solid" borderColor="whiteAlpha.200">
              <HStack spacing={1} mb="2px">
                <Icon as={FiCornerUpLeft} boxSize={3} color="whiteAlpha.700" />
                <Text fontSize="10px" color="whiteAlpha.700" fontWeight="600">
                  @{replyPreview?.sender || 'message'}
                </Text>
              </HStack>
              <Text fontSize="11px" color="whiteAlpha.700" noOfLines={2}>
                {replyPreview?.content || 'Original message unavailable'}
              </Text>
            </Box>
          )}
          {isDeleted ? (
            <Text fontSize="sm" color="whiteAlpha.600" fontStyle="italic">
              Message deleted
            </Text>
          ) : (
            <>
              {textContent && (
                <Box
                  onClick={() => onReplySelect?.(msg)}
                  cursor={onReplySelect ? 'pointer' : 'default'}
                  role={onReplySelect ? 'button' : undefined}
                  tabIndex={onReplySelect ? 0 : undefined}
                  onKeyDown={handleReplyKeyDown}
                >
                  <Text fontSize="sm" color="white" lineHeight="1.5" whiteSpace="pre-wrap" wordBreak="break-word">
                    <MentionAwareText content={textContent} activeUsername={activeUsername} />
                  </Text>
                </Box>
              )}
              {imageUrls.length > 0 && (
                <VStack align="stretch" spacing={2} mt={2}>
                  {imageUrls.map(url => (
                    <Box
                      key={`${msg._id}-${url}`}
                      borderRadius="10px"
                      overflow="hidden"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      bg="blackAlpha.200"
                      cursor="pointer"
                      onClick={() => setLightboxUrl(url)}
                    >
                      <Image
                        src={url}
                        alt="Shared image"
                        maxH="280px"
                        w="100%"
                        objectFit="cover"
                        loading="lazy"
                      />
                    </Box>
                  ))}
                </VStack>
              )}
              {shortsV && <ShortPreview v={shortsV} />}
            </>
          )}
          <Text fontSize="9px" color="whiteAlpha.400" mt="4px" textAlign="right">
            {msg.editedAt ? `edited • ${formatTime(msg.createdAt)}` : formatTime(msg.createdAt)}
          </Text>
        </Box>
        {lightboxUrl && (
          <Modal isOpen onClose={() => setLightboxUrl(null)} size="full" isCentered>
            <ModalOverlay bg="blackAlpha.900" onClick={() => setLightboxUrl(null)} />
            <ModalContent bg="transparent" shadow="none" onClick={() => setLightboxUrl(null)}>
              <ModalBody display="flex" alignItems="center" justifyContent="center" p={4}>
                <Image
                  src={lightboxUrl}
                  alt="Expanded image"
                  maxH="90vh"
                  maxW="90vw"
                  objectFit="contain"
                  borderRadius="8px"
                  onClick={e => e.stopPropagation()}
                />
              </ModalBody>
            </ModalContent>
          </Modal>
        )}
        {!isDeleted && (onEditSelect || onDeleteSelect || forwardTargets?.length) && (
          <HStack justify="flex-end" mt={1} spacing={3}>
            {onEditSelect && (
              <Button
                size="xs"
                variant="link"
                color="overlay.500"
                fontSize="10px"
                fontWeight="500"
                minH="unset"
                onClick={() => onEditSelect(msg)}
                onKeyDown={handleEditKeyDown}
                _hover={{ color: 'overlay.700' }}
              >
                Edit
              </Button>
            )}
            {forwardTargets && onForwardSelect && (
              <ForwardButton msg={msg} targets={forwardTargets} onForwardSelect={onForwardSelect} />
            )}
            {onDeleteSelect && (
              <Button
                size="xs"
                variant="link"
                color="red.300"
                fontSize="10px"
                fontWeight="500"
                minH="unset"
                onClick={() => onDeleteSelect(msg)}
                _hover={{ color: 'red.200' }}
              >
                Delete
              </Button>
            )}
          </HStack>
        )}
      </Box>
    );
  }

  return (
    <Box
      animation={`${fadeIn} 0.18s ease`}
      alignSelf="flex-start"
      maxW="88%"
    >
      <HStack align="flex-start" spacing={2}>
        <Box
          onDoubleClick={() => onOpenDm?.(msg.sender)}
          cursor={canOpenDm ? 'pointer' : 'default'}
          title={canOpenDm ? 'Double-click to open DM' : undefined}
          pt="2px"
        >
          <Avatar size="2xs" username={msg.sender} />
        </Box>
        <Box minW={0}>
          <Text
            fontSize="10px"
            color="blue.300"
            fontWeight="600"
            letterSpacing="0.03em"
            mb="2px"
            onClick={() => onMentionSelect?.(msg.sender)}
            onDoubleClick={() => onOpenDm?.(msg.sender)}
            cursor={canOpenDm || onMentionSelect ? 'pointer' : 'default'}
            title={canOpenDm ? 'Click to mention • Double-click to open DM' : 'Click to mention'}
            noOfLines={1}
          >
            @{msg.sender}
          </Text>
          <Box
            bg={highlightMention ? 'rgba(168, 85, 247, 0.18)' : 'overlay.100'}
            px={3}
            py={2}
            borderRadius="16px 16px 16px 4px"
            border="1px solid"
            borderColor={highlightMention ? 'rgba(168, 85, 247, 0.4)' : 'overlay.100'}
          >
            {msg.replyTo && (
              <Box mb={2} px={2} py={1} borderRadius="8px" bg="blackAlpha.300" border="1px solid" borderColor="overlay.200">
                <HStack spacing={1} mb="2px">
                  <Icon as={FiCornerUpLeft} boxSize={3} color="overlay.700" />
                  <Text fontSize="10px" color="overlay.700" fontWeight="600">
                    @{replyPreview?.sender || 'message'}
                  </Text>
                </HStack>
                <Text fontSize="11px" color="overlay.700" noOfLines={2}>
                  {replyPreview?.content || 'Original message unavailable'}
                </Text>
              </Box>
            )}
            {isDeleted ? (
              <Text fontSize="sm" color="overlay.600" fontStyle="italic">
                Message deleted
              </Text>
            ) : (
              <>
                {textContent && (
                  <Box
                    onClick={() => onReplySelect?.(msg)}
                    cursor={onReplySelect ? 'pointer' : 'default'}
                    role={onReplySelect ? 'button' : undefined}
                    tabIndex={onReplySelect ? 0 : undefined}
                    onKeyDown={handleReplyKeyDown}
                  >
                    <Text fontSize="sm" color="text" lineHeight="1.5" whiteSpace="pre-wrap" wordBreak="break-word">
                      <MentionAwareText content={textContent} activeUsername={activeUsername} />
                    </Text>
                  </Box>
                )}
                {imageUrls.length > 0 && (
                  <VStack align="stretch" spacing={2} mt={2}>
                    {imageUrls.map(url => (
                      <Box
                        key={`${msg._id}-${url}`}
                        borderRadius="10px"
                        overflow="hidden"
                        border="1px solid"
                        borderColor="overlay.200"
                        bg="blackAlpha.200"
                        cursor="pointer"
                        onClick={() => setLightboxUrl(url)}
                      >
                        <Image
                          src={url}
                          alt="Shared image"
                          maxH="280px"
                          w="100%"
                          objectFit="cover"
                          loading="lazy"
                        />
                      </Box>
                    ))}
                  </VStack>
                )}
                {shortsV && <ShortPreview v={shortsV} />}
              </>
            )}
            <Text fontSize="9px" color="overlay.400" mt="4px" textAlign="right">
              {msg.editedAt ? `edited • ${formatTime(msg.createdAt)}` : formatTime(msg.createdAt)}
            </Text>
          </Box>
          {!isDeleted && forwardTargets && onForwardSelect && (
            <HStack justify="flex-start" mt={1}>
              <ForwardButton msg={msg} targets={forwardTargets} onForwardSelect={onForwardSelect} />
            </HStack>
          )}
        </Box>
      </HStack>
    </Box>
  );
}

function ConversationRow({ conv, isActive, onClick }: { conv: Conversation; isActive: boolean; onClick: () => void }) {
  return (
    <Flex
      onClick={onClick}
      px={3}
      py={2}
      borderRadius="10px"
      bg={isActive ? 'blue.600' : 'transparent'}
      border="1px solid"
      borderColor={isActive ? 'blue.400' : 'transparent'}
      cursor="pointer"
      _hover={{ bg: isActive ? 'blue.600' : 'overlay.100' }}
      align="center"
      justify="space-between"
    >
      <HStack spacing={2} minW={0}>
        <ConversationAvatar conv={conv} />
        <Box minW={0}>
          <Text color="text" fontSize="sm" fontWeight="600" noOfLines={1}>
            {conv.type === 'channel' ? `#${conv.name}` : conv.name}
          </Text>
          <Text fontSize="11px" color="overlay.600" noOfLines={1}>
            {conv.lastMessage ? `${conv.lastMessage.sender}: ${conv.lastMessage.content}` : 'No messages yet'}
          </Text>
        </Box>
      </HStack>
      {(conv.unreadCount || 0) > 0 && (
        <Box
          minW="18px"
          h="18px"
          px="5px"
          borderRadius="full"
          bg="blue.400"
          color="white"
          fontSize="10px"
          fontWeight="700"
          lineHeight="18px"
          textAlign="center"
        >
          {conv.unreadCount! > 99 ? '99+' : conv.unreadCount}
        </Box>
      )}
    </Flex>
  );
}

/**
 * Rows already on screen to keep while the conversations call is pending or
 * failed: DMs, every group, and public channels the fresh channel list still
 * has (they carry lastMessage and unread counts that Channel data lacks).
 * Groups are never in that list (/api/chat/channels returns channels only),
 * so only the conversations call can drop them.
 */
function keptConversations(list: Conversation[], channels: Channel[] | null): Conversation[] {
  const live = new Set((channels ?? []).map(ch => ch._id));
  return list.filter(c => c.type !== 'channel' || !c.isPublic || live.has(c._id));
}

/** Public rows currently shown, so a missing channel response can keep them. */
function channelsFromConversations(list: Conversation[]): Channel[] {
  return list
    .filter(c => c.isPublic && c.type !== 'dm')
    .map(c => ({
      _id: c._id,
      name: c.name,
      description: c.description,
      type: c.type,
      conversationKind: c.type === 'group' ? 'group' : 'channel',
      isPublic: true,
      owner: c.owner,
      members: c.members || [],
      memberCount: c.memberCount ?? 0,
    }));
}

export default function ChatPanel({
  isOpen,
  onClose,
  isMinimized,
  onMinimize,
  onRestore,
  onPopout,
  isPopoutWindow,
  onUnreadChange,
}: ChatPanelProps) {
  const { username: user } = useCurrentUser();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const isTablet = useBreakpointValue({ base: false, md: true, lg: false }) ?? false;
  // Same cutoff as the fixed mobile header and bottom tab bar (`sm` = 480px).
  // Below that, the sheet used to cover both, so there was no way out except
  // a 24px icon.
  const isPhone = useBreakpointValue({ base: true, sm: false });

  const [authState, setAuthState] = useState<'idle' | 'connecting' | 'done' | 'error'>('idle');
  const [authError, setAuthError] = useState<string>('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // The list starts empty, so "no rows" cannot mean "nothing to show" until a
  // load has actually finished. Without this the panel printed "No
  // conversations yet" while the request was still in flight, and forever
  // after a failed one (both calls used to be `.catch(() => [])`).
  const [listLoad, setListLoad] = useState<{ status: 'loading' | 'ready' | 'error'; notice: string }>({ status: 'loading', notice: '' });
  const [listReloadNonce, setListReloadNonce] = useState(0);
  const listLoadSeqRef = useRef(0);
  const [activeConversationId, setActiveConversationId] = useState<string>(
    process.env.NEXT_PUBLIC_CHAT_DEFAULT_CHANNEL || 'general'
  );
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [listAction, setListAction] = useState<'none' | 'new-dm' | 'new-group'>('none');
  const [dmTarget, setDmTarget] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMemberDraft, setGroupMemberDraft] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupIsPublic, setGroupIsPublic] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [memberActionBusy, setMemberActionBusy] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [confirmBlockUser, setConfirmBlockUser] = useState<string | null>(null);
  const [showMemoFallbackPrompt, setShowMemoFallbackPrompt] = useState<null | { conversationId: string; peer: string }>(null);
  const [memoAssetChoice, setMemoAssetChoice] = useState<'HIVE' | 'HBD'>('HIVE');
  const [mutedUsers, setMutedUsers] = useState<string[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageCache, setMessageCache] = useState<Record<string, Message>>({});
  const [dmStatus, setDmStatus] = useState<DmStatusInfo | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [panelSize, setPanelSize] = useState(DESKTOP_PANEL_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);
  const [showResizeHint, setShowResizeHint] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([]);
  const [activeMentionIdx, setActiveMentionIdx] = useState(0);
  const [hasValidMentionInDraft, setHasValidMentionInDraft] = useState(false);
  // True while the viewport should stay on the newest row. Drives Virtuoso's
  // followOutput prop directly: a function that returns false still counts as
  // "following" for item-resize and yanks someone who scrolled up.
  const [stickToLatest, setStickToLatest] = useState(true);
  const [scrollConversationId, setScrollConversationId] = useState(activeConversationId);

  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const messageNodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oldestIdRef = useRef<string | undefined>(undefined);
  const latestIdRef = useRef<string | undefined>(undefined);
  const stickToLatestRef = useRef(true);
  const settledAtLatestRef = useRef(false);
  const pinGenerationRef = useRef(0);
  const didBackfillShortListRef = useRef(false);
  const atTopRef = useRef(false);
  const replaceTokenRef = useRef(0);
  const [firstItemIndex, setFirstItemIndex] = useState(CHAT_LIST_INDEX_ORIGIN);
  const firstItemIndexRef = useRef(CHAT_LIST_INDEX_ORIGIN);
  const messagesRef = useRef<Message[]>([]);
  const activeConversationIdRef = useRef(activeConversationId);
  const loadingOlderRef = useRef(false);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const gifPopover = useDisclosure();
  const composerInputRef = useRef<HTMLInputElement>(null);
  const typingPingAtRef = useRef(0);
  const typingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInteractedRef = useRef(false);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const didPrimeMessageSetRef = useRef(false);
  messagesRef.current = messages;
  activeConversationIdRef.current = activeConversationId;

  // Drop the previous thread before paint so Virtuoso remounts on the new
  // conversation's rows (initialTopMostItemIndex only applies on mount).
  if (scrollConversationId !== activeConversationId) {
    setScrollConversationId(activeConversationId);
    stickToLatestRef.current = true;
    setStickToLatest(true);
    settledAtLatestRef.current = false;
    didBackfillShortListRef.current = false;
    atTopRef.current = false;
    messagesRef.current = [];
    setMessages(prev => (prev.length === 0 ? prev : []));
    setLoadingMessages(true);
    firstItemIndexRef.current = CHAT_LIST_INDEX_ORIGIN;
    setFirstItemIndex(CHAT_LIST_INDEX_ORIGIN);
  }

  const commitMessageWindow = useCallback((prev: Message[], next: Message[]) => {
    const first = nextFirstItemIndex(firstItemIndexRef.current, prev, next);
    firstItemIndexRef.current = first;
    messagesRef.current = next;
    setFirstItemIndex(first);
    setMessages(next);
    if (next.length > 0) {
      oldestIdRef.current = next[0]._id;
      latestIdRef.current = next[next.length - 1]._id;
    } else {
      oldestIdRef.current = undefined;
      latestIdRef.current = undefined;
    }
  }, []);

  const isAuthed = chatService.isAuthenticated();
  // Session is the stored JWT, not authState. authState starts at 'idle' on
  // every mount, so gating on idle re-prompts Keychain after a remount even
  // though posting authority was already proven. See lib/chat/authGate.ts.
  // Logout for a different Hive account runs in an effect, after this render.
  // Until that token is cleared, a previous owner's session must not compose.
  const tokenOwner = chatService.getTokenUsername();
  const tokenOwnedBySomeoneElse = !!user && !!tokenOwner && tokenOwner !== user;
  const showAuthGate = shouldShowChatAuthGate(user, isAuthed) || tokenOwnedBySomeoneElse;
  const activeConversation = conversations.find(c => c._id === activeConversationId);
  const showJumpToNow = messages.length > 0 && !stickToLatest;
  const typingLabel = useMemo(() => {
    if (!typingUsers.length) return '';
    if (typingUsers.length === 1) return `@${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `@${typingUsers[0]} and @${typingUsers[1]} are typing...`;
    return `${typingUsers.length} people are typing...`;
  }, [typingUsers]);
  const showDmSeen = activeConversation?.type === 'dm'
    && dmThreadShowsSeen(messages, user, dmStatus?.peerSeenAt);
  const sortedMentions = useMemo(
    () => messages
      .map((msg, idx) => ({ msg, idx }))
      .filter(entry => messageMentionsUser(entry.msg.content, user)),
    [messages, user]
  );
  const latestMention = sortedMentions.length ? sortedMentions[sortedMentions.length - 1] : null;
  const shouldShowJumpToMention =
    !!latestMention &&
    latestMention.idx < Math.max(messages.length - 3, 0);
  const mentionCandidates = useMemo(() => {
    if (!activeConversation) return [] as string[];
    const set = new Set<string>();
    if (user) set.add(normalizeMentionToken(user));
    if (activeConversation.members?.length) {
      for (const member of activeConversation.members) set.add(normalizeMentionToken(member));
    }
    if (activeConversation.peer) set.add(normalizeMentionToken(activeConversation.peer));
    if (messages.length) {
      for (const msg of messages) set.add(normalizeMentionToken(msg.sender));
    }
    return Array.from(set).filter(Boolean);
  }, [activeConversation, messages, user]);

  const mergeConversations = useCallback((baseConversations: Conversation[], publicChannels: Channel[]): Conversation[] => {
    const byId = new Map(baseConversations.map(c => [c._id, c]));
    for (const ch of publicChannels) {
      if (!byId.has(ch._id)) {
        byId.set(ch._id, {
          _id: ch._id,
          name: ch.name,
          description: ch.description,
          type: ch.conversationKind === 'group' ? 'group' : 'channel',
          isPublic: ch.isPublic,
          owner: ch.owner,
          members: ch.members || [],
          memberCount: ch.memberCount,
          lastMessage: null,
          unread: false,
        });
      }
    }
    return Array.from(byId.values());
  }, []);

  const resetListActions = () => {
    setListAction('none');
    setDmTarget('');
    setGroupName('');
    setGroupMemberDraft('');
    setGroupMembers([]);
    setGroupIsPublic(false);
    setPanelError('');
  };

  const reloadConversations = useCallback(async () => {
    if (!isOpen || !isAuthed) return;
    // Background refresh: a failed call keeps what is on screen. Treating a
    // transient error as "no conversations" used to wipe every DM from the
    // list until the next successful poll.
    const [pubChannels, convs] = await Promise.all([
      chatService.getChannels().catch(() => null),
      chatService.getConversations().catch(() => null),
    ]);
    if (pubChannels) setChannels(pubChannels);
    if (!pubChannels && !convs) return;
    setConversations(prev => mergeConversations(convs ?? prev, pubChannels ?? []));
  }, [isAuthed, isOpen, mergeConversations]);

  const reloadPreferences = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const prefs = await chatService.getPreferences();
      setMutedUsers(prefs.mutedUsers || []);
      setBlockedUsers(prefs.blockedUsers || []);
    } catch {}
  }, [isAuthed]);

  // ── Load conversations/channels on open ────────────────────────────────
  // Public channels and the signed-in user's conversations are independent:
  // each is applied the moment it lands, so a slow or failing authed call can
  // never hide #General. A result that has not arrived (or failed) stays
  // null and the rows already on screen are kept, so reopening or Retry
  // cannot flash the list down to channels-only. A newer load supersedes an
  // older one, so a late response from a previous isAuthed value cannot
  // overwrite fresh state.
  useEffect(() => {
    if (!isOpen) return;
    const seq = ++listLoadSeqRef.current;
    const superseded = () => listLoadSeqRef.current !== seq;
    let pubChannels: Channel[] | null = null;
    let convs: Conversation[] | null = null;
    const apply = () => {
      if (pubChannels != null) setChannels(pubChannels);
      if (pubChannels == null && convs == null) return;
      setConversations(prev => mergeConversations(
        convs ?? keptConversations(prev, pubChannels),
        pubChannels ?? channelsFromConversations(prev),
      ));
    };

    setListLoad(prev => ({ status: 'loading', notice: prev.notice }));
    if (!isAuthed) {
      // Drop the previous account's rows; only public channels remain.
      convs = [];
      apply();
    }

    const channelsLoad = chatService.getChannels().then(
      result => {
        if (superseded()) return null;
        pubChannels = result;
        apply();
        return null;
      },
      (err: unknown) => (superseded() ? null : err),
    );
    const convsLoad = isAuthed
      ? chatService.getConversations().then(
        result => {
          if (superseded()) return null;
          convs = result;
          apply();
          return null;
        },
        (err: unknown) => (superseded() ? null : err),
      )
      : Promise.resolve(null);

    Promise.all([channelsLoad, convsLoad]).then(([channelsErr, convsErr]) => {
      if (superseded()) return;
      if (channelsErr && convsErr) {
        setListLoad({ status: 'error', notice: 'Could not load conversations.' });
      } else if (channelsErr) {
        setListLoad({ status: 'error', notice: 'Could not load public channels.' });
      } else if (convsErr) {
        const expired = convsErr instanceof Error && convsErr.message === 'CHAT_UNAUTHORIZED';
        setListLoad({
          status: 'error',
          notice: expired
            ? 'Your chat session expired. Reconnect to see your DMs and groups.'
            : 'Could not load your DMs and groups.',
        });
      } else {
        setListLoad({ status: 'ready', notice: '' });
      }
    });

    if (isAuthed) reloadPreferences();
    return () => {
      // Closing or re-running invalidates this load; a stale `loading` would
      // otherwise stick if the panel reopens before it settles.
      if (listLoadSeqRef.current === seq) listLoadSeqRef.current++;
    };
  }, [isOpen, isAuthed, mergeConversations, reloadPreferences, listReloadNonce]);

  useEffect(() => {
    if (!conversations.length) return;
    const exists = conversations.some(c => c._id === activeConversationId);
    if (!exists) setActiveConversationId(conversations[0]._id);
  }, [conversations, activeConversationId]);

  // If the current user differs from whoever the stored chat token was issued
  // for, clear it so the new account authenticates fresh. Intentionally skipped
  // when user is null (logout) — the same user logging back in should reuse
  // their existing valid token without triggering a re-authenticate.
  useEffect(() => {
    if (!user) return;
    const tokenOwner = chatService.getTokenUsername();
    if (tokenOwner && tokenOwner !== user) {
      chatService.logout();
      setAuthState('idle');
      setAuthError('');
      messagesRef.current = [];
      firstItemIndexRef.current = CHAT_LIST_INDEX_ORIGIN;
      setFirstItemIndex(CHAT_LIST_INDEX_ORIGIN);
      setMessages([]);
      setConversations([]);
      // logout() only changes isAuthed when the old token was still live. If
      // it had already expired nothing else re-runs the load effect, and the
      // list stayed empty until the panel was closed and reopened.
      setListReloadNonce(n => n + 1);
    }
  }, [user]);

  useEffect(() => {
    if (isMobile || isPopoutWindow) return;
    try {
      const raw = localStorage.getItem(CHAT_PANEL_SIZE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { width?: number; height?: number };
      if (typeof parsed.width !== 'number' || typeof parsed.height !== 'number') return;
      const maxWidth = Math.max(DESKTOP_PANEL_MIN.width, window.innerWidth - 24);
      const maxHeight = Math.max(DESKTOP_PANEL_MIN.height, window.innerHeight - 24);
      setPanelSize({
        width: Math.min(Math.max(parsed.width, DESKTOP_PANEL_MIN.width), maxWidth),
        height: Math.min(Math.max(parsed.height, DESKTOP_PANEL_MIN.height), maxHeight),
      });
    } catch {}
  }, [isMobile, isPopoutWindow]);

  useEffect(() => {
    if (isMobile || isPopoutWindow) return;
    localStorage.setItem(CHAT_PANEL_SIZE_KEY, JSON.stringify(panelSize));
  }, [panelSize, isMobile, isPopoutWindow]);

  useEffect(() => {
    if (isMobile || isPopoutWindow) return;
    try {
      const dismissed = localStorage.getItem(CHAT_PANEL_RESIZE_HINT_KEY) === '1';
      setShowResizeHint(!dismissed);
    } catch {
      setShowResizeHint(true);
    }
  }, [isMobile, isPopoutWindow]);

  const fetchMessagesForConversation = useCallback(async (
    convId: string,
    convType: Conversation['type'] | undefined,
    opts: { before?: string; after?: string; limit?: number } = {}
  ): Promise<Message[]> => {
    if (!convId) return [];
    if (convType === 'dm') {
      const out = await chatService.getDmMessages(convId, opts);
      setDmStatus(out.status || null);
      return out.messages;
    }
    setDmStatus(null);
    return chatService.getMessages(convId, opts);
  }, []);

  // ── Load messages when active conversation changes ────────────────────
  const loadMessages = useCallback(async (
    convId: string,
    convType: Conversation['type'] | undefined,
    append = false
  ) => {
    if (append) {
      if (loadingOlderRef.current) return;
      const replaceToken = replaceTokenRef.current;
      const convAtStart = activeConversationIdRef.current;
      loadingOlderRef.current = true;
      setLoadingOlder(true);
      try {
        const msgs = await fetchMessagesForConversation(convId, convType, {
          before: oldestIdRef.current,
          limit: INITIAL_MESSAGE_LIMIT,
        });
        if (replaceToken !== replaceTokenRef.current || convAtStart !== activeConversationIdRef.current) return;
        if (!msgs.length) {
          oldestIdRef.current = undefined;
        } else {
          const prev = messagesRef.current;
          commitMessageWindow(prev, mergeMessagesById(msgs, prev, MAX_ACTIVE_MESSAGES));
        }
      } catch {
        // Keep the page the user is already reading.
      } finally {
        setLoadingOlder(false);
        loadingOlderRef.current = false;
      }
      return;
    }

    const token = ++replaceTokenRef.current;
    setLoadingMessages(true);
    try {
      const msgs = await fetchMessagesForConversation(convId, convType, {
        limit: INITIAL_MESSAGE_LIMIT,
      });
      if (token !== replaceTokenRef.current) return;
      const ordered = trimMessagesTail(sortMessagesAsc(msgs), MAX_ACTIVE_MESSAGES);
      commitMessageWindow(messagesRef.current, ordered);
    } catch {
      if (token !== replaceTokenRef.current) return;
      commitMessageWindow(messagesRef.current, []);
    } finally {
      if (token === replaceTokenRef.current) setLoadingMessages(false);
    }
  }, [commitMessageWindow, fetchMessagesForConversation]);

  // ── Read receipts ──────────────────────────────────────────────────────
  //  Fetching a conversation no longer marks it read server-side: a background
  //  poll behind a minimized panel used to clear the badge for messages nobody
  //  had looked at. The panel now says so explicitly, and only while the thread
  //  is genuinely on screen — open, not minimized, tab visible, and on mobile
  //  (where the list and thread are separate screens) actually in the thread.
  const markActiveConversationRead = useCallback(async () => {
    if (!isOpen || isMinimized || !isAuthed || !activeConversationId) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (isMobile && mobileView !== 'thread') return;
    const snapshot = await chatService.markRead(activeConversationId);
    if (!snapshot) return;
    onUnreadChange?.(snapshot.total);
    setConversations(prev => prev.map(c => (
      c._id === activeConversationId ? { ...c, unread: false, unreadCount: 0 } : c
    )));
  }, [activeConversationId, isAuthed, isMinimized, isMobile, isOpen, mobileView, onUnreadChange]);

  // Re-marks on every genuine message change — refreshMessageDeltas bails out
  // when there is nothing new, so this does not fire on an idle poll tick.
  useEffect(() => { markActiveConversationRead(); }, [markActiveConversationRead, messages]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onReturn = () => {
      if (document.visibilityState === 'visible') markActiveConversationRead();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [markActiveConversationRead]);

  useEffect(() => {
    if (!isOpen || isMinimized) return;
    // New open or new conversation: ignore atBottom/startReached from the
    // list we just left, and pin again once the new page mounts.
    pinGenerationRef.current += 1;
    settledAtLatestRef.current = false;
    didBackfillShortListRef.current = false;
    atTopRef.current = false;
    stickToLatestRef.current = true;
    setStickToLatest(true);
    oldestIdRef.current = undefined;
    latestIdRef.current = undefined;
    setDmStatus(null);
    setReplyingTo(null);
    setEditingMessage(null);
    setMessageCache({});
    setTypingUsers([]);
    setMentionQuery('');
    setMentionSuggestions([]);
    setHasValidMentionInDraft(false);
    prevMessageIdsRef.current = new Set();
    didPrimeMessageSetRef.current = false;
    loadMessages(activeConversationId, activeConversation?.type);
  }, [isOpen, isMinimized, activeConversationId, activeConversation?.type, loadMessages]);

  useEffect(() => {
    const markInteracted = () => {
      hasInteractedRef.current = true;
    };
    window.addEventListener('pointerdown', markInteracted, { passive: true });
    window.addEventListener('keydown', markInteracted);
    return () => {
      window.removeEventListener('pointerdown', markInteracted);
      window.removeEventListener('keydown', markInteracted);
    };
  }, []);

  useEffect(() => {
    const maybeMention = getActiveMentionDraft(draft, draft.length);
    if (!maybeMention) {
      setMentionQuery('');
      setMentionSuggestions([]);
      setActiveMentionIdx(0);
      const hasValid = !!(user && draft.match(MENTION_REGEX)?.some(m => normalizeMentionToken(m) === normalizeMentionToken(user)));
      setHasValidMentionInDraft(hasValid);
      return;
    }
    const q = maybeMention.query;
    const options = mentionCandidates
      .filter(candidate => candidate.includes(q))
      .slice(0, 6);
    setMentionQuery(q);
    setMentionSuggestions(options);
    setActiveMentionIdx(prev => Math.min(prev, Math.max(options.length - 1, 0)));
    const hasValid = !!(user && draft.match(MENTION_REGEX)?.some(m => normalizeMentionToken(m) === normalizeMentionToken(user)));
    setHasValidMentionInDraft(hasValid);
  }, [draft, mentionCandidates, user]);

  useEffect(() => {
    if (!isOpen || isMinimized || !isAuthed || !activeConversationId) return;

    const loadTyping = async () => {
      try {
        const out = await chatService.getTyping(activeConversationId);
        setTypingUsers(out.users || []);
      } catch {}
    };
    loadTyping();
    typingPollRef.current = setInterval(loadTyping, 3000);
    return () => {
      if (typingPollRef.current) clearInterval(typingPollRef.current);
      typingPollRef.current = null;
    };
  }, [isOpen, isMinimized, isAuthed, activeConversationId]);

  useEffect(() => {
    if (!messages.length) return;
    setMessageCache(prev => {
      const next = { ...prev };
      for (const msg of messages) next[msg._id] = msg;
      return next;
    });
  }, [messages]);

  const playNotificationChime = useCallback(() => {
    if (!hasInteractedRef.current) return;
    playChime();
  }, []);

  useEffect(() => {
    const nextIds = new Set(messages.map(m => m._id));
    if (!didPrimeMessageSetRef.current) {
      prevMessageIdsRef.current = nextIds;
      didPrimeMessageSetRef.current = true;
      return;
    }
    const prevIds = prevMessageIdsRef.current;
    const incoming = messages.filter(m => !prevIds.has(m._id) && m.sender !== user);
    prevMessageIdsRef.current = nextIds;
    if (!incoming.length || !activeConversation) return;

    const shouldChime = incoming.some(m => {
      if (activeConversation.type === 'dm') return true;
      const mention = messageMentionsUser(m.content, user);
      const replyToMine = !!(m.replyTo && messageCache[m.replyTo]?.sender === user);
      return mention || replyToMine;
    });
    if (shouldChime) playNotificationChime();
  }, [messages, activeConversation, user, messageCache, playNotificationChime]);

  async function handleOpenConversation(conv: Conversation) {
    setPanelError('');
    setActiveConversationId(conv._id);
    if (isMobile) setMobileView('thread');
    if (!isAuthed || conv.type === 'dm') return;
    try { await chatService.joinChannel(conv._id); } catch {}
  }

  async function handleCreateDmSubmit() {
    const target = dmTarget.trim();
    if (!target || !isAuthed) return;
    try {
      const conv = await chatService.openDm(target);
      await reloadConversations();
      setActiveConversationId(conv._id);
      if (isMobile) setMobileView('thread');
      resetListActions();
    } catch (err: any) {
      setPanelError(err?.message || 'Could not start DM');
    }
  }

  async function openDmByUsername(targetUser: string) {
    if (!targetUser || !isAuthed) return;
    try {
      const conv = await chatService.openDm(targetUser);
      await reloadConversations();
      setActiveConversationId(conv._id);
      if (isMobile) setMobileView('thread');
      setPanelError('');
    } catch (err: any) {
      setPanelError(err?.message || 'Could not open DM');
    }
  }

  async function handleCreateGroupSubmit() {
    if (!isAuthed) return;
    const name = groupName.trim();
    if (!name) return;
    try {
      const group = await chatService.createGroup({ name, members: groupMembers, isPublic: groupIsPublic });
      await reloadConversations();
      setActiveConversationId(group._id);
      if (isMobile) setMobileView('thread');
      resetListActions();
    } catch (err: any) {
      setPanelError(err?.message || 'Could not create group');
    }
  }

  function addGroupMemberDraft() {
    const normalized = groupMemberDraft.trim().toLowerCase();
    if (!normalized) return;
    setGroupMembers(prev => (prev.includes(normalized) ? prev : [...prev, normalized]));
    setGroupMemberDraft('');
  }

  function removeDraftGroupMember(member: string) {
    setGroupMembers(prev => prev.filter(m => m !== member));
  }

  async function handleAddMember() {
    if (!activeConversation || activeConversation.type !== 'group') return;
    const member = memberInput.trim();
    if (!member || memberActionBusy) return;
    setMemberActionBusy(true);
    setPanelError('');
    try {
      await chatService.addGroupMember(activeConversation._id, member);
      setMemberInput('');
      await reloadConversations();
    } catch (err: any) {
      setPanelError(err?.message || 'Could not add member');
    }
    setMemberActionBusy(false);
  }

  async function handleRemoveMember(member: string) {
    if (!activeConversation || activeConversation.type !== 'group' || memberActionBusy) return;
    const confirmed = window.confirm(`Remove @${member} from this group?`);
    if (!confirmed) return;
    setMemberActionBusy(true);
    setPanelError('');
    try {
      await chatService.removeGroupMember(activeConversation._id, member);
      await reloadConversations();
    } catch (err: any) {
      setPanelError(err?.message || 'Could not remove member');
    }
    setMemberActionBusy(false);
  }

  async function handleMute(username: string) {
    try {
      await chatService.muteUser(username);
      await reloadPreferences();
      await loadMessages(activeConversationId, activeConversation?.type);
    } catch {}
  }

  async function handleUnmute(username: string) {
    try {
      await chatService.unmuteUser(username);
      await reloadPreferences();
      await loadMessages(activeConversationId, activeConversation?.type);
    } catch {}
  }

  async function handleBlock(username: string) {
    setConfirmBlockUser(username);
  }

  async function confirmBlockAction() {
    const username = confirmBlockUser;
    if (!username) return;
    try {
      await chatService.blockUser(username);
      await reloadPreferences();
      await loadMessages(activeConversationId, activeConversation?.type);
    } catch {}
    setConfirmBlockUser(null);
  }

  async function handleUnblock(username: string) {
    try {
      await chatService.unblockUser(username);
      await reloadPreferences();
      await loadMessages(activeConversationId, activeConversation?.type);
    } catch {}
  }

  async function handleMemoFallbackConfirm() {
    if (!showMemoFallbackPrompt || !user) return;
    const payload = `[sent from snapie.io] New DM from @${user}. Open snapie.io chat to reply.`;
    try {
      await transferEncryptedMemoWithAioha(showMemoFallbackPrompt.peer, 0.001, memoAssetChoice, payload);
      await chatService.markDmMemoFallbackSent(showMemoFallbackPrompt.conversationId);
      setPanelError('');
    } catch (memoErr: any) {
      setPanelError(memoErr?.message || 'Hive memo notify failed');
    }
    setShowMemoFallbackPrompt(null);
  }

  async function handleImageUpload(file: File) {
    if (!file || !user) return;
    if (!CHAT_IMAGE_ACCEPT.includes(file.type)) {
      setPanelError('Unsupported image type (use jpg, png, webp, gif, avif).');
      return;
    }
    if (file.size <= 0 || file.size > CHAT_IMAGE_MAX_BYTES) {
      setPanelError('Image must be smaller than 8MB.');
      return;
    }
    setUploadingImage(true);
    setPanelError('');
    try {
      const signatureRes = await signMessageWithAioha(file.name, KeyTypes.Posting);
      if (!signatureRes.success || !signatureRes.result) {
        throw new Error('Could not sign image upload request');
      }
      const form = new FormData();
      form.append('file', file);
      form.append('username', user);
      form.append('signature', String(signatureRes.result));
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Image upload failed');
      }
      setDraft(prev => `${prev}${prev.trim() ? '\n' : ''}${data.url}`);
    } catch (err: any) {
      setPanelError(err?.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  const loadOlderMessages = useCallback(async () => {
    if (!activeConversationId || !activeConversation?.type) return;
    if (loadingOlderRef.current || loadingMessages) return;
    if (!oldestIdRef.current) return;
    await loadMessages(activeConversationId, activeConversation?.type, true);
  }, [activeConversationId, activeConversation?.type, loadMessages, loadingMessages]);

  const refreshMessageDeltas = useCallback(async () => {
    if (!activeConversationId || !activeConversation?.type) return;

    const convId = activeConversationId;
    const replaceToken = replaceTokenRef.current;
    const newestId = latestIdRef.current;
    const delta = await fetchMessagesForConversation(convId, activeConversation?.type, {
      after: newestId,
      limit: DELTA_MESSAGE_LIMIT,
    });
    if (!delta.length) return;
    if (replaceToken !== replaceTokenRef.current || convId !== activeConversationIdRef.current) return;

    const prev = messagesRef.current;
    commitMessageWindow(prev, mergeMessagesById(prev, delta, MAX_ACTIVE_MESSAGES));
  }, [activeConversationId, activeConversation?.type, commitMessageWindow, fetchMessagesForConversation]);

  // ── Poll fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || isMinimized || !isAuthed) return;
    pollRef.current = setInterval(async () => {
      try {
        await reloadConversations();
        await refreshMessageDeltas();
      } catch {}
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isOpen, isMinimized, isAuthed, activeConversationId, activeConversation?.type, reloadConversations, refreshMessageDeltas]);

  // ── FCM foreground listener ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthed) return () => {};
    return onForegroundMessage(async () => {
      await reloadConversations();
      await refreshMessageDeltas();
    });
  }, [isAuthed, activeConversationId, activeConversation?.type, reloadConversations, refreshMessageDeltas]);

  // Id cursors for paging. The list itself is positioned by Virtuoso
  // (initialTopMostItemIndex on mount, followOutput after that) — scrollToIndex
  // in this effect does not run on the list's first mount.
  useEffect(() => {
    if (!messages.length) return;
    oldestIdRef.current = messages[0]?._id;
    latestIdRef.current = messages[messages.length - 1]?._id;
  }, [messages]);

  function jumpToLatestMention() {
    if (!latestMention) return;
    virtuosoRef.current?.scrollToIndex({
      index: absoluteMessageIndex(firstItemIndexRef.current, latestMention.idx),
      align: 'center',
      behavior: 'smooth',
    });
  }

  function jumpToNow() {
    stickToLatestRef.current = true;
    setStickToLatest(true);
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'smooth' });
  }

  function handleResizeStart(e: ReactMouseEvent<HTMLDivElement>) {
    if (isMobile || isPopoutWindow) return;
    e.preventDefault();
    e.stopPropagation();
    setShowResizeHint(false);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: panelSize.width,
      height: panelSize.height,
    };
    setIsResizing(true);
    try {
      localStorage.setItem(CHAT_PANEL_RESIZE_HINT_KEY, '1');
    } catch {}
  }

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const dx = start.x - e.clientX;
      const dy = start.y - e.clientY;
      const maxWidth = Math.max(DESKTOP_PANEL_MIN.width, window.innerWidth - 24);
      const maxHeight = Math.max(DESKTOP_PANEL_MIN.height, window.innerHeight - 24);
      setPanelSize({
        width: Math.min(Math.max(start.width + dx, DESKTOP_PANEL_MIN.width), maxWidth),
        height: Math.min(Math.max(start.height + dy, DESKTOP_PANEL_MIN.height), maxHeight),
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // ── Auth ──────────────────────────────────────────────────────────────
  async function handleConnect() {
    if (!user) return;
    setAuthState('connecting');
    try {
      await chatService.authenticate(user, async (challenge) => {
        const res = await signMessageWithAioha(challenge, KeyTypes.Posting);
        if (!res.success || !res.result) throw new Error('Sign failed');
        return res.result as string;
      });
      await chatService.joinChannel(activeConversationId);
      const fcmToken = await getFCMToken();
      if (fcmToken) {
        await chatService.registerDevice(fcmToken);
      }
      await reloadConversations();
      setAuthState('done');
    } catch (err: any) {
      setAuthError(err?.message || 'Unknown error');
      setAuthState('error');
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────
  async function handleSend() {
    const content = draft.trim();
    if (!content || sending || !activeConversation) return;
    setSending(true);
    setDraft('');
    const replyTo = replyingTo?._id;
    try {
      setPanelError('');
      if (editingMessage) {
        let edited: Message;
        if (activeConversation.type === 'dm') {
          edited = await chatService.editDmMessage(activeConversation._id, editingMessage._id, content);
        } else {
          edited = await chatService.editMessage(activeConversation._id, editingMessage._id, content);
        }
        setMessages(prev => prev.map(m => (m._id === edited._id ? edited : m)));
        setMessageCache(prev => ({ ...prev, [edited._id]: edited }));
        setEditingMessage(null);
        setReplyingTo(null);
        setSending(false);
        return;
      }
      let msg: Message;
      let dmDelivery: { hasFcm: boolean; memoSuggested: boolean; cooldownMs: number } | undefined;
      if (activeConversation.type === 'dm') {
        const out = await chatService.sendDmMessageWithDelivery(activeConversation._id, content, replyTo);
        msg = out.message;
        dmDelivery = out.delivery;
      } else {
        msg = await chatService.sendMessage(activeConversation._id, content, replyTo);
      }
      const prevMessages = messagesRef.current;
      commitMessageWindow(prevMessages, trimMessagesTail([...prevMessages, msg], MAX_ACTIVE_MESSAGES));
      setMessageCache(prev => ({ ...prev, [msg._id]: msg }));
      setReplyingTo(null);
      try { await chatService.setTyping(activeConversation._id, false); } catch {}
      if (activeConversation.type === 'dm' && dmDelivery?.memoSuggested && activeConversation.peer && user) {
        setShowMemoFallbackPrompt({ conversationId: activeConversation._id, peer: activeConversation.peer });
      }
      await reloadConversations();
    } catch {
      // A rejected mutation clears hive-chat-token inside ChatService before
      // it throws CHAT_UNAUTHORIZED. The composer gate reads that token via
      // isAuthenticated(), not authState, so setAuthState('idle') would not
      // change what the user sees. Restoring the draft re-renders onto the gate.
      setDraft(content);
    }
    setSending(false);
  }

  async function handleDeleteMessage(target: Message) {
    if (!activeConversation) return;
    if (!window.confirm('Delete this message? It will be replaced with "Message deleted".')) return;
    try {
      let edited: Message;
      if (activeConversation.type === 'dm') {
        edited = await chatService.editDmMessage(activeConversation._id, target._id, '[deleted]');
      } else {
        edited = await chatService.editMessage(activeConversation._id, target._id, '[deleted]');
      }
      setMessages(prev => prev.map(m => (m._id === edited._id ? edited : m)));
      setMessageCache(prev => ({ ...prev, [edited._id]: edited }));
      if (editingMessage?._id === target._id) {
        setEditingMessage(null);
        setDraft('');
      }
    } catch (err: any) {
      setPanelError(err?.message || 'Could not delete the message.');
    }
  }

  async function handleForwardMessage(source: Message, target: Conversation) {
    const quoted = `> Forwarded from @${source.sender}\n${source.content.split('\n').map(l => `> ${l}`).join('\n')}`;
    try {
      setPanelError('');
      if (target.type === 'dm') {
        await chatService.sendDmMessageWithDelivery(target._id, quoted);
      } else {
        await chatService.sendMessage(target._id, quoted);
      }
      await reloadConversations();
      setActiveConversationId(target._id);
      if (isMobile) setMobileView('thread');
    } catch (err: any) {
      setPanelError(err?.message || 'Could not forward the message.');
    }
  }

  function applyMentionSuggestion(username: string) {
    const input = composerInputRef.current;
    const cursorPos = input?.selectionStart ?? draft.length;
    const active = getActiveMentionDraft(draft, cursorPos);
    if (!active) return;
    const next = `${draft.slice(0, active.start)}@${username} ${draft.slice(active.end)}`;
    setDraft(next);
    setMentionSuggestions([]);
    setMentionQuery('');
    setActiveMentionIdx(0);
    const nextCursor = active.start + username.length + 2;
    requestAnimationFrame(() => {
      if (!composerInputRef.current) return;
      composerInputRef.current.focus();
      composerInputRef.current.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function insertMentionForUser(username: string) {
    const normalized = normalizeMentionToken(username);
    if (!normalized) return;
    setDraft(prev => {
      const token = `@${normalized}`;
      if (prev.includes(token)) return prev;
      const spacer = prev.trim().length ? ' ' : '';
      return `${prev}${spacer}${token} `;
    });
    requestAnimationFrame(() => {
      composerInputRef.current?.focus();
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMentionIdx(prev => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMentionIdx(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        applyMentionSuggestion(mentionSuggestions[activeMentionIdx] || mentionSuggestions[0]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionSuggestions([]);
        setMentionQuery('');
        return;
      }
    }

    if (isAuthed && activeConversation && !sending) {
      const now = Date.now();
      if (now - typingPingAtRef.current > 1500) {
        typingPingAtRef.current = now;
        chatService.setTyping(activeConversation._id, true).catch(() => {});
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Panel dimensions ───────────────────────────────────────────────────
  const panelW = isPopoutWindow ? '100vw' : (isMobile ? '100vw' : `${panelSize.width}px`);
  const panelH = isPopoutWindow ? '100vh' : (isMobile ? '85vh' : `${panelSize.height}px`);
  const panelBottom = isPopoutWindow ? '0' : (isMobile ? '0' : '0');
  const panelRight = isPopoutWindow ? '0' : (isMobile ? '0' : '16px');
  const borderRadius = isPopoutWindow ? '0' : (isMobile ? '20px 20px 0 0' : '16px 16px 0 0');
  // Phone: sit between the fixed header and the tab bar, inside the safe area,
  // so both stay tappable and the close control is never under the notch.
  const phoneTop = 'calc(56px + env(safe-area-inset-top))';
  const phoneBottom = 'calc(60px + env(safe-area-inset-bottom))';
  const isDesktopSplit = !isMobile && !isTablet;
  const isTabletLayout = isTablet;
  const showList = isMobile ? mobileView === 'list' : true;
  const showThread = isMobile ? mobileView === 'thread' : true;
  const canManageMembers = !!(
    user &&
    activeConversation &&
    activeConversation.type === 'group' &&
    activeConversation.owner === user
  );
  const pinGeneration = pinGenerationRef.current;
  // Day breaks follow list order, not Virtuoso's absolute index. The first
  // loaded message of each local calendar day carries the separator, so a
  // prepend of older history moves it up with that day.
  const daySeparatorIds = useMemo(() => messageIdsWithDaySeparator(messages), [messages]);
  // Stable component types — an inline Header/Footer is a new component every
  // render, which remounts Virtuoso's chrome and drops the scroll pin.
  const messageListComponents = useMemo(() => ({
    Header: () => loadingOlder ? (
      <Flex justify="center" align="center" py={2}>
        <Spinner color="blue.300" size="xs" />
      </Flex>
    ) : null,
  }), [loadingOlder]);

  if (!isOpen) return null;

  // ── Minimized strip ────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <Box
        position="fixed"
        bottom="0"
        right={{ base: '0', md: '16px' }}
        w={{ base: '100vw', md: '220px' }}
        h="44px"
        bg="surface"
        backdropFilter="blur(12px)"
        borderRadius="12px 12px 0 0"
        border="1px solid"
        borderColor="overlay.100"
        borderBottom="none"
        zIndex={1400}
        px={4}
        cursor="pointer"
        onClick={onRestore}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        _hover={{ borderColor: 'blue.500' }}
        transition="border-color 0.2s"
      >
        <HStack spacing={2}>
          <Icon as={FiMessageSquare} color="blue.300" boxSize={4} />
          <Text fontSize="sm" fontWeight="600" color="text">Chat</Text>
        </HStack>
        <HStack spacing={1}>
          <IconButton aria-label="Restore" icon={<FiMaximize2 />} size="xs" variant="ghost" color="overlay.600" _hover={{ color: 'white' }} onClick={onRestore} />
          <IconButton aria-label="Close" icon={<FiX />} size="xs" variant="ghost" color="overlay.600" _hover={{ color: 'white' }} onClick={(e) => { e.stopPropagation(); onClose(); }} />
        </HStack>
      </Box>
    );
  }

  return (
    <>
      {/* Tablet sheet backdrop. Phones leave the header and tab bar uncovered. */}
      {isMobile && !isPhone && (
        <Box
          position="fixed" inset="0" zIndex={1399}
          bg="blackAlpha.600"
          backdropFilter="blur(2px)"
          onClick={onClose}
        />
      )}

      <Box
        data-chat-mobile-shell={isPhone ? 'true' : undefined}
        position="fixed"
        top={isPhone ? phoneTop : undefined}
        bottom={isPhone ? phoneBottom : panelBottom}
        left={isPhone ? 0 : undefined}
        right={isPhone ? 0 : panelRight}
        w={isPhone ? 'auto' : panelW}
        h={isPhone ? 'auto' : panelH}
        maxH={isPhone ? 'none' : (isPopoutWindow ? '100vh' : (isMobile ? '85vh' : 'calc(100vh - 24px)'))}
        zIndex={isPhone ? 997 : 1400}
        display="flex"
        flexDirection="column"
        cursor={isResizing ? 'nwse-resize' : 'default'}
        bg="surface"
        backdropFilter="blur(16px)"
        borderRadius={isPhone ? '16px' : borderRadius}
        border="1px solid"
        borderColor="overlay.100"
        borderBottom={isPopoutWindow ? '1px solid' : 'none'}
        overflow="hidden"
        boxShadow="0 -4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(24,168,255,0.08)"
        sx={{
          '&': { animation: isMobile ? 'slideUp 0.25s cubic-bezier(0.32,0.72,0,1)' : 'fadeUp 0.2s ease' },
          '@keyframes slideUp': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
          '@keyframes fadeUp': { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        }}
      >
        {!isMobile && !isPopoutWindow && (
          <Tooltip label="Drag to resize" hasArrow placement="top" isOpen={showResizeHint ? undefined : false}>
            <Box
              position="absolute"
              left="0"
              bottom="0"
              w="22px"
              h="22px"
              cursor="nwse-resize"
              zIndex={1500}
              onMouseDown={handleResizeStart}
              title="Drag to resize"
              bg="overlay.100"
              borderTop="1px solid"
              borderRight="1px solid"
              borderColor="overlay.200"
              borderTopRightRadius="8px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              _hover={{ bg: 'overlay.200' }}
            >
              <Icon as={FiMaximize2} boxSize={3} color="overlay.700" />
            </Box>
          </Tooltip>
        )}

        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          px={4}
          py={3}
          borderBottom="1px solid"
          borderColor="overlay.100"
          flexShrink={0}
        >
          <HStack spacing={2} minW={0}>
            {isPhone && (
              <Button
                aria-label="Close chat"
                leftIcon={<FiArrowLeft />}
                size="sm"
                variant="ghost"
                color="text"
                fontWeight="700"
                flexShrink={0}
                minH="44px"
                minW="44px"
                px={2}
                onClick={onClose}
              >
                Close
              </Button>
            )}
            {isMobile && mobileView === 'thread' && (
              <IconButton
                aria-label="Back to conversations"
                icon={<FiArrowLeft />}
                size={isPhone ? 'sm' : 'xs'}
                variant="ghost"
                color="overlay.700"
                minW={isPhone ? '44px' : undefined}
                minH={isPhone ? '44px' : undefined}
                flexShrink={0}
                onClick={() => setMobileView('list')}
              />
            )}
            <Text fontSize="sm" fontWeight="700" color="text" letterSpacing="0.02em" noOfLines={1}>
              {showList && !showThread ? 'Conversations' : (activeConversation?.type === 'channel' ? `#${activeConversation?.name}` : activeConversation?.name || 'Chat')}
            </Text>
            {showThread && activeConversation?.type === 'dm' && (
              <HStack spacing={1}>
                <Box
                  w="7px"
                  h="7px"
                  borderRadius="full"
                  bg={dmStatus?.peerOnline ? 'green.300' : 'overlay.400'}
                />
                <Text fontSize="10px" color={dmStatus?.peerOnline ? 'green.200' : 'overlay.500'}>
                  {dmStatus?.peerOnline ? 'Online' : (dmStatus?.peerLastSeenAt ? `Last seen ${formatLastSeen(dmStatus.peerLastSeenAt)}` : 'Offline')}
                </Text>
              </HStack>
            )}
            {showThread && activeConversation?.type === 'group' && (
              <Badge colorScheme="purple" variant="subtle" borderRadius="full" px={2}>
                {activeConversation.members?.length || 0} members
              </Badge>
            )}
          </HStack>
          <HStack spacing={1}>
            {isMobile && isAuthed && (
              <Menu>
                <MenuButton
                  as={IconButton}
                  aria-label="New conversation"
                  icon={<FiPlus />}
                  size="xs"
                  variant="ghost"
                  color="overlay.500"
                  _hover={{ color: 'white', bg: 'overlay.100' }}
                />
                <MenuList bg="muted" borderColor="overlay.200">
                  <MenuItem
                    bg="muted"
                    color="text"
                    onClick={() => {
                      setMobileView('list');
                      setListAction('new-dm');
                      setPanelError('');
                    }}
                  >
                    Start DM
                  </MenuItem>
                  <MenuItem
                    bg="muted"
                    color="text"
                    onClick={() => {
                      setMobileView('list');
                      setListAction('new-group');
                      setPanelError('');
                    }}
                  >
                    Create group
                  </MenuItem>
                </MenuList>
              </Menu>
            )}
            {!isMobile && showList && isAuthed && (
              <>
                <IconButton
                  aria-label="Start DM"
                  icon={<FiMessageSquare />}
                  size="xs"
                  variant="ghost"
                  color="overlay.500"
                  _hover={{ color: 'white', bg: 'overlay.100' }}
                  onClick={() => {
                    setListAction(listAction === 'new-dm' ? 'none' : 'new-dm');
                    setPanelError('');
                  }}
                />
                <IconButton
                  aria-label="Create group"
                  icon={<FiUsers />}
                  size="xs"
                  variant="ghost"
                  color="overlay.500"
                  _hover={{ color: 'white', bg: 'overlay.100' }}
                  onClick={() => {
                    setListAction(listAction === 'new-group' ? 'none' : 'new-group');
                    setPanelError('');
                  }}
                />
              </>
            )}
            {onMinimize && !isMobile && (
              <IconButton
                aria-label="Minimize"
                icon={<FiMinus />}
                size="xs"
                variant="ghost"
                color="overlay.500"
                _hover={{ color: 'white', bg: 'overlay.100' }}
                onClick={onMinimize}
              />
            )}
            {!isMobile && !!onPopout && !isPopoutWindow && (
              <Tooltip label="Open chat in a separate window" hasArrow>
                <Button
                  size="xs"
                  leftIcon={<FiExternalLink />}
                  variant="ghost"
                  color="overlay.500"
                  _hover={{ color: 'white', bg: 'overlay.100' }}
                  onClick={onPopout}
                >
                  Pop out
                </Button>
              </Tooltip>
            )}
            {!isPhone && (
              <IconButton
                aria-label="Close chat"
                icon={<FiX />}
                size={isMobile ? 'md' : 'xs'}
                variant="ghost"
                color={isMobile ? 'text' : 'overlay.500'}
                minW={isMobile ? '44px' : undefined}
                minH={isMobile ? '44px' : undefined}
                _hover={{ color: 'white', bg: 'overlay.100' }}
                onClick={onClose}
              />
            )}
          </HStack>
        </Flex>

        <Flex
          flex="1"
          minH={0}
          direction={isDesktopSplit ? 'row' : 'column'}
        >
          {/* Conversation list */}
          {showList && (
            <Flex
              px={3}
              py={2}
              direction="column"
              gap={2}
              overflowY="auto"
              flex={isDesktopSplit ? '0 0 42%' : '1'}
              minW={0}
              borderRight={isDesktopSplit ? '1px solid' : 'none'}
              borderRightColor={isDesktopSplit ? 'overlay.100' : 'transparent'}
              sx={{
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                '&::-webkit-scrollbar': { width: '3px' },
                '&::-webkit-scrollbar-track': { bg: 'transparent' },
                '&::-webkit-scrollbar-thumb': { bg: 'overlay.200', borderRadius: 'full' },
              }}
            >
            {listAction === 'new-dm' && (
              <Box border="1px solid" borderColor="overlay.200" borderRadius="10px" p={3} bg="overlay.50">
                <Text color="text" fontSize="xs" mb={2}>Start Direct Message</Text>
                <HStack>
                  <Input
                    value={dmTarget}
                    onChange={e => setDmTarget(e.target.value)}
                    placeholder="Hive username"
                    size="sm"
                    bg="blackAlpha.300"
                    borderColor="overlay.200"
                    color="text"
                  />
                  <Button size="sm" colorScheme="blue" onClick={handleCreateDmSubmit}>Start</Button>
                </HStack>
              </Box>
            )}
            {listAction === 'new-group' && (
              <Box border="1px solid" borderColor="overlay.200" borderRadius="10px" p={3} bg="overlay.50">
                <Text color="text" fontSize="xs" mb={2}>Create Group Chat</Text>
                <VStack spacing={2} align="stretch">
                  <Input
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="Group name"
                    size="sm"
                    bg="blackAlpha.300"
                    borderColor="overlay.200"
                    color="text"
                  />
                  <Input
                    value={groupMemberDraft}
                    onChange={e => setGroupMemberDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addGroupMemberDraft();
                      }
                    }}
                    placeholder="Add member username"
                    size="sm"
                    bg="blackAlpha.300"
                    borderColor="overlay.200"
                    color="text"
                  />
                  <HStack justify="space-between">
                    <HStack spacing={2} flexWrap="wrap">
                      {groupMembers.map(member => (
                        <HStack key={member} spacing={1} bg="overlay.100" px={2} py={1} borderRadius="full">
                          <Avatar size="2xs" username={member} />
                          <Text fontSize="10px" color="overlay.700">@{member}</Text>
                          <IconButton
                            aria-label={`Remove ${member}`}
                            icon={<FiX />}
                            size="2xs"
                            variant="ghost"
                            color="red.300"
                            onClick={() => removeDraftGroupMember(member)}
                          />
                        </HStack>
                      ))}
                    </HStack>
                    <Button size="xs" variant="ghost" colorScheme="blue" onClick={addGroupMemberDraft}>
                      Add
                    </Button>
                  </HStack>
                  <HStack justify="space-between">
                    <HStack>
                      <Switch size="sm" isChecked={groupIsPublic} onChange={e => setGroupIsPublic(e.target.checked)} />
                      <Text color="overlay.700" fontSize="xs">Public group</Text>
                    </HStack>
                    <Button size="sm" colorScheme="blue" onClick={handleCreateGroupSubmit}>Create</Button>
                  </HStack>
                </VStack>
              </Box>
            )}
            {!!panelError && (
              <Text fontSize="xs" color="red.300" px={1}>{panelError}</Text>
            )}
            {!!listLoad.notice && listLoad.status !== 'loading' && (
              <Flex align="center" justify="space-between" gap={2} px={2} py={1} borderRadius="8px" bg="overlay.50" role="alert">
                <Text fontSize="xs" color="red.300">{listLoad.notice}</Text>
                <Button size="xs" variant="ghost" colorScheme="blue" onClick={() => setListReloadNonce(n => n + 1)}>
                  Retry
                </Button>
              </Flex>
            )}
            {conversations.length === 0 ? (
              <Flex flex="1" align="center" justify="center" py={6}>
                {listLoad.status === 'loading' ? (
                  <Spinner color="blue.300" size="sm" aria-label="Loading conversations" />
                ) : (
                  <Text fontSize="xs" color="overlay.500">
                    {listLoad.status === 'error' ? 'Conversations unavailable' : 'No conversations yet'}
                  </Text>
                )}
              </Flex>
            ) : (
              conversations.map(conv => (
                <ConversationRow
                  key={conv._id}
                  conv={conv}
                  isActive={conv._id === activeConversationId}
                  onClick={() => handleOpenConversation(conv)}
                />
              ))
            )}
            </Flex>
          )}

          {/* Thread view */}
          {showThread && (
            <Flex flex="1" minW={0} direction="column">
              {canManageMembers && (
                <Box px={3} py={2} borderBottom="1px solid" borderColor="overlay.100" bg="overlay.50">
                  <Text fontSize="10px" color="overlay.600" mb={2}>Group members (owner controls)</Text>
                  <HStack mb={2}>
                    <Input
                      value={memberInput}
                      onChange={e => setMemberInput(e.target.value)}
                      placeholder="Add member username"
                      size="xs"
                      bg="blackAlpha.300"
                      borderColor="overlay.200"
                      color="text"
                    />
                    <Button size="xs" colorScheme="blue" onClick={handleAddMember} isLoading={memberActionBusy}>Add</Button>
                  </HStack>
                  <HStack spacing={2} flexWrap="wrap">
                    {(activeConversation?.members || []).map(member => (
                      <HStack key={member} spacing={1} bg="overlay.100" px={2} py={1} borderRadius="full">
                        <Avatar size="2xs" username={member} />
                        <Text fontSize="10px" color="overlay.700">@{member}</Text>
                        {member === activeConversation.owner && (
                          <Badge colorScheme="purple" variant="solid" fontSize="8px" borderRadius="full">Owner</Badge>
                        )}
                        {member !== activeConversation.owner && (
                          <Badge colorScheme="blue" variant="subtle" fontSize="8px" borderRadius="full">Member</Badge>
                        )}
                        {member !== activeConversation.owner && (
                          <IconButton
                            aria-label={`Remove ${member}`}
                            icon={<FiX />}
                            size="2xs"
                            variant="ghost"
                            color="red.300"
                            onClick={() => handleRemoveMember(member)}
                          />
                        )}
                      </HStack>
                    ))}
                  </HStack>
                  <Divider mt={2} borderColor="overlay.200" />
                </Box>
              )}
              <Box
                flex="1"
                position="relative"
                px={4}
                py={3}
                sx={{
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                  '& [data-virtuoso-scroller]::-webkit-scrollbar': { width: '3px' },
                  '& [data-virtuoso-scroller]::-webkit-scrollbar-track': { bg: 'transparent' },
                  '& [data-virtuoso-scroller]::-webkit-scrollbar-thumb': { bg: 'overlay.200', borderRadius: 'full' },
                }}
              >
                {loadingMessages ? (
                  <Flex justify="center" align="center" flex="1" h="100%">
                    <Spinner color="blue.300" size="sm" />
                  </Flex>
                ) : messages.length === 0 ? (
                  <Flex direction="column" justify="center" align="center" flex="1" gap={2} opacity={0.5} h="100%">
                    <Icon as={FiMessageSquare} boxSize={8} color="overlay.400" />
                    <Text fontSize="xs" color="overlay.500">No messages yet. Say hello!</Text>
                  </Flex>
                ) : (
                  <Virtuoso
                    key={activeConversationId}
                    ref={virtuosoRef}
                    style={{ height: '100%' }}
                    data={messages}
                    alignToBottom
                    followOutput={stickToLatest ? 'auto' : false}
                    initialTopMostItemIndex={{ index: 'LAST', align: 'end' }}
                    firstItemIndex={firstItemIndex}
                    computeItemKey={(_index, message) => message._id}
                    atBottomThreshold={32}
                    atTopStateChange={(atTop) => {
                      if (pinGeneration !== pinGenerationRef.current) return;
                      atTopRef.current = atTop;
                    }}
                    atBottomStateChange={(atBottom) => {
                      if (pinGeneration !== pinGenerationRef.current) return;
                      const prev: ChatScrollPin = {
                        stickToLatest: stickToLatestRef.current,
                        settledAtLatest: settledAtLatestRef.current,
                      };
                      const next = pinAfterAtBottom(prev, atBottom);
                      settledAtLatestRef.current = next.settledAtLatest;
                      if (next.stickToLatest !== stickToLatestRef.current) {
                        stickToLatestRef.current = next.stickToLatest;
                        setStickToLatest(next.stickToLatest);
                      }
                      if (!prev.settledAtLatest && next.settledAtLatest) {
                        const generation = pinGeneration;
                        queueMicrotask(() => {
                          if (generation !== pinGenerationRef.current || didBackfillShortListRef.current) return;
                          const pin: ChatScrollPin = {
                            stickToLatest: stickToLatestRef.current,
                            settledAtLatest: settledAtLatestRef.current,
                          };
                          if (!shouldBackfillShortThread(pin, atTopRef.current, false)) return;
                          didBackfillShortListRef.current = true;
                          loadOlderMessages();
                        });
                      }
                    }}
                    startReached={() => {
                      if (pinGeneration !== pinGenerationRef.current) return;
                      const pin: ChatScrollPin = {
                        stickToLatest: stickToLatestRef.current,
                        settledAtLatest: settledAtLatestRef.current,
                      };
                      if (!shouldPageOlderHistory(pin)) return;
                      loadOlderMessages();
                    }}
                    itemContent={(_index, msg) => (
                      <Box
                        key={msg._id}
                        ref={el => {
                          messageNodeRefs.current[msg._id] = el;
                        }}
                        pb={2}
                      >
                        {daySeparatorIds.has(msg._id) && (
                          <DaySeparator label={formatDaySeparatorLabel(msg.createdAt)} />
                        )}
                        <MessageBubble
                          msg={msg}
                          isOwn={msg.sender === user}
                          onOpenDm={openDmByUsername}
                          onReplySelect={setReplyingTo}
                          onMentionSelect={insertMentionForUser}
                          replyPreview={msg.replyTo ? messageCache[msg.replyTo] || null : null}
                          onEditSelect={msg.sender === user ? (m) => {
                            setEditingMessage(m);
                            setReplyingTo(null);
                            setDraft(m.content);
                          } : undefined}
                          onDeleteSelect={msg.sender === user ? handleDeleteMessage : undefined}
                          forwardTargets={conversations.filter(c => c._id !== activeConversationId)}
                          onForwardSelect={handleForwardMessage}
                          activeUsername={user}
                          highlightMention={messageMentionsUser(msg.content, user)}
                        />
                      </Box>
                    )}
                    components={messageListComponents}
                  />
                )}
                {showJumpToNow && (
                  <IconButton
                    aria-label="Jump to current messages"
                    icon={<FiArrowDown />}
                    size="sm"
                    colorScheme="blue"
                    variant="solid"
                    position="absolute"
                    bottom="82px"
                    right="14px"
                    borderRadius="full"
                    onClick={jumpToNow}
                    title="Jump to current messages"
                  />
                )}
                {shouldShowJumpToMention && (
                  <IconButton
                    aria-label="Jump to latest mention"
                    icon={<FiArrowUp />}
                    size="sm"
                    colorScheme="yellow"
                    variant="solid"
                    position="absolute"
                    bottom={showJumpToNow ? '124px' : '82px'}
                    right="14px"
                    borderRadius="full"
                    onClick={jumpToLatestMention}
                    title="Jump to latest @mention"
                  />
                )}
              </Box>

              {(showDmSeen || !!typingLabel) && (
                <Box px={4} pb={1} flexShrink={0}>
                  {showDmSeen && (
                    <Text fontSize="10px" color="overlay.500" textAlign="right" pr={1}>
                      Seen
                    </Text>
                  )}
                  {!!typingLabel && (
                    <Text fontSize="11px" color="overlay.600">
                      {typingLabel}
                    </Text>
                  )}
                </Box>
              )}

              {/* Auth overlay / compose bar */}
              {showAuthGate ? (
                <Flex
                  px={4}
                  py={4}
                  borderTop="1px solid"
                  borderColor="overlay.100"
                  direction="column"
                  align="center"
                  gap={2}
                  flexShrink={0}
                >
                  {!user ? (
                    <Text fontSize="xs" color="overlay.500" textAlign="center">
                      Log in to send messages
                    </Text>
                  ) : (
                    <>
                      <Text fontSize="xs" color="overlay.500" textAlign="center">
                        Connect your Hive account to chat
                      </Text>
                      <Button
                        size="sm"
                        colorScheme="blue"
                        onClick={handleConnect}
                        isLoading={authState === 'connecting'}
                        loadingText="Signing in…"
                        leftIcon={<Icon as={FiPlus} />}
                        borderRadius="full"
                        px={6}
                      >
                        Connect
                      </Button>
                      {authState === 'error' && (
                        <Text fontSize="xs" color="red.400">{authError || 'Sign failed — try again'}</Text>
                      )}
                    </>
                  )}
                </Flex>
              ) : (
              <Flex
                px={3}
                py={isTabletLayout ? 2 : 3}
                borderTop="1px solid"
                borderColor="overlay.100"
                gap={2}
                align="center"
                flexShrink={0}
                pb={isPhone ? '12px' : (isTabletLayout ? 'calc(8px + env(safe-area-inset-bottom))' : 'calc(12px + env(safe-area-inset-bottom))')}
                direction="column"
              >
                {confirmBlockUser && (
                  <Box
                    w="100%"
                    border="1px solid"
                    borderColor="red.400"
                    bg="red.900"
                    borderRadius="10px"
                    p={2}
                  >
                    <Text fontSize="xs" color="text" mb={2}>
                      Block @{confirmBlockUser}? You will no longer receive their messages.
                    </Text>
                    <HStack justify="flex-end">
                      <Button size="xs" variant="ghost" onClick={() => setConfirmBlockUser(null)}>Cancel</Button>
                      <Button size="xs" colorScheme="red" onClick={confirmBlockAction}>Block</Button>
                    </HStack>
                  </Box>
                )}
                {showMemoFallbackPrompt && (
                  <Box
                    w="100%"
                    border="1px solid"
                    borderColor="blue.400"
                    bg="blue.900"
                    borderRadius="10px"
                    p={2}
                  >
                    <Text fontSize="xs" color="text" mb={2}>
                      @{showMemoFallbackPrompt.peer} has no push token. Send encrypted Hive memo fallback?
                    </Text>
                    <HStack mb={2}>
                      <Button
                        size="xs"
                        variant={memoAssetChoice === 'HIVE' ? 'solid' : 'ghost'}
                        colorScheme="blue"
                        onClick={() => setMemoAssetChoice('HIVE')}
                      >
                        HIVE
                      </Button>
                      <Button
                        size="xs"
                        variant={memoAssetChoice === 'HBD' ? 'solid' : 'ghost'}
                        colorScheme="blue"
                        onClick={() => setMemoAssetChoice('HBD')}
                      >
                        HBD
                      </Button>
                    </HStack>
                    <HStack justify="flex-end">
                      <Button size="xs" variant="ghost" onClick={() => setShowMemoFallbackPrompt(null)}>Skip</Button>
                      <Button size="xs" colorScheme="blue" onClick={handleMemoFallbackConfirm}>
                        Send 0.001 {memoAssetChoice}
                      </Button>
                    </HStack>
                  </Box>
                )}
                {replyingTo && (
                  <Box
                    w="100%"
                    border="1px solid"
                    borderColor="blue.300"
                    bg="blue.900"
                    borderRadius="10px"
                    p={2}
                  >
                    <HStack justify="space-between" mb={1}>
                      <HStack spacing={1}>
                        <Icon as={FiCornerUpLeft} boxSize={3} color="blue.200" />
                        <Text fontSize="11px" color="blue.100" fontWeight="600">
                          Replying to @{replyingTo.sender}
                        </Text>
                      </HStack>
                      <IconButton
                        aria-label="Cancel reply"
                        icon={<FiX />}
                        size="2xs"
                        variant="ghost"
                        onClick={() => setReplyingTo(null)}
                      />
                    </HStack>
                    <Text fontSize="11px" color="overlay.700" noOfLines={2}>
                      {replyingTo.content}
                    </Text>
                  </Box>
                )}
                {editingMessage && (
                  <Box
                    w="100%"
                    border="1px solid"
                    borderColor="orange.300"
                    bg="orange.900"
                    borderRadius="10px"
                    p={2}
                  >
                    <HStack justify="space-between" mb={1}>
                      <Text fontSize="11px" color="orange.100" fontWeight="600">
                        Editing your message
                      </Text>
                      <IconButton
                        aria-label="Cancel edit"
                        icon={<FiX />}
                        size="2xs"
                        variant="ghost"
                        onClick={() => {
                          setEditingMessage(null);
                          setDraft('');
                        }}
                      />
                    </HStack>
                    <Text fontSize="11px" color="overlay.700" noOfLines={2}>
                      {editingMessage.content}
                    </Text>
                  </Box>
                )}
                <HStack spacing={1} w="100%" justify="space-between">
                  <HStack spacing={1} flexWrap="wrap">
                    {QUICK_EMOJIS.map(em => (
                      <Button
                        key={em}
                        size="xs"
                        variant="ghost"
                        minW="unset"
                        px={2}
                        onClick={() => setDraft(prev => `${prev}${em}`)}
                      >
                        {em}
                      </Button>
                    ))}
                  </HStack>
                  {activeConversation?.type === 'dm' && activeConversation.peer && (
                    <Menu>
                      <MenuButton as={Button} size="xs" variant="ghost" rightIcon={<FiChevronDown />}>
                        Manage
                      </MenuButton>
                      <MenuList bg="muted" borderColor="overlay.200">
                        {mutedUsers.includes(activeConversation.peer) ? (
                          <MenuItem bg="muted" color="text" onClick={() => handleUnmute(activeConversation.peer || '')}>
                            Unmute @{activeConversation.peer}
                          </MenuItem>
                        ) : (
                          <MenuItem bg="muted" color="text" onClick={() => handleMute(activeConversation.peer || '')}>
                            Mute @{activeConversation.peer}
                          </MenuItem>
                        )}
                        {blockedUsers.includes(activeConversation.peer) ? (
                          <MenuItem bg="muted" color="text" onClick={() => handleUnblock(activeConversation.peer || '')}>
                            Unblock @{activeConversation.peer}
                          </MenuItem>
                        ) : (
                          <MenuItem bg="muted" color="red.300" onClick={() => handleBlock(activeConversation.peer || '')}>
                            Block @{activeConversation.peer}
                          </MenuItem>
                        )}
                      </MenuList>
                    </Menu>
                  )}
                </HStack>
                <HStack w="100%" align="stretch">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept={CHAT_IMAGE_ACCEPT.join(',')}
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.currentTarget.files?.[0];
                      if (file) void handleImageUpload(file);
                    }}
                  />
                  <IconButton
                    aria-label="Upload image"
                    icon={<FiImage />}
                    size="sm"
                    variant="ghost"
                    borderRadius="full"
                    isLoading={uploadingImage}
                    onClick={() => imageInputRef.current?.click()}
                    isDisabled={sending || !isAuthed}
                    flexShrink={0}
                  />
                  <Popover
                    isOpen={gifPopover.isOpen}
                    onOpen={gifPopover.onOpen}
                    onClose={gifPopover.onClose}
                    placement="top-start"
                  >
                    <PopoverTrigger>
                      <Button
                        aria-label="GIF"
                        size="sm"
                        variant="ghost"
                        borderRadius="full"
                        fontSize="11px"
                        fontWeight="700"
                        px={2}
                        isDisabled={sending || !isAuthed}
                        flexShrink={0}
                      >
                        GIF
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent bg="muted" borderColor="overlay.200" w="320px">
                      <PopoverArrow bg="muted" />
                      <PopoverBody maxH="360px" overflowY="auto">
                        <GiphySelector
                          apiKey={process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'qXGQXTPKyNJByTFZpW7Kb0tEFeB90faV'}
                          onSelect={(gif: IGif, e: SyntheticEvent<HTMLElement>) => {
                            e.preventDefault();
                            const url = gif.images.original.url.split('?')[0];
                            setDraft(prev => `${prev}${prev.trim() ? '\n' : ''}${url}`);
                            gifPopover.onClose();
                          }}
                        />
                      </PopoverBody>
                    </PopoverContent>
                  </Popover>
                  <Input
                    ref={composerInputRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={e => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      const files: File[] = [];
                      for (const item of items) {
                        if (item.type?.startsWith('image/')) {
                          const file = item.getAsFile();
                          if (file) files.push(file);
                        }
                      }
                      if (files.length) {
                        e.preventDefault();
                        files.forEach(file => void handleImageUpload(file));
                      }
                    }}
                    placeholder="Message…"
                    size={isTabletLayout ? 'md' : 'sm'}
                    borderRadius={isTabletLayout ? '14px' : 'full'}
                    bg={hasValidMentionInDraft ? 'rgba(234, 179, 8, 0.18)' : 'overlay.50'}
                    border="1px solid"
                    borderColor={hasValidMentionInDraft ? 'yellow.400' : 'overlay.100'}
                    color="text"
                    _placeholder={{ color: 'overlay.400' }}
                    _focus={{ borderColor: 'blue.400', boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)', bg: 'overlay.100' }}
                    _hover={{ borderColor: 'overlay.300' }}
                    maxLength={2000}
                    autoComplete="off"
                    minW={0}
                    flex="1"
                    whiteSpace="nowrap"
                    textOverflow="ellipsis"
                    overflowX="hidden"
                  />
                  <IconButton
                    aria-label="Send"
                    icon={<FiSend />}
                    size={isTabletLayout ? 'md' : 'sm'}
                    colorScheme="blue"
                    borderRadius="full"
                    isLoading={sending}
                    isDisabled={!draft.trim()}
                    onClick={handleSend}
                    flexShrink={0}
                  />
                </HStack>
                {mentionSuggestions.length > 0 && (
                  <Box
                    w="100%"
                    border="1px solid"
                    borderColor="overlay.200"
                    borderRadius="10px"
                    bg="muted"
                    overflow="hidden"
                  >
                    <Text fontSize="10px" color="overlay.600" px={2} pt={2}>
                      Mention suggestions {mentionQuery ? `for "${mentionQuery}"` : ''}
                    </Text>
                    <VStack align="stretch" spacing={0} p={1}>
                      {mentionSuggestions.map((name, idx) => (
                        <Button
                          key={name}
                          size="sm"
                          justifyContent="flex-start"
                          variant="ghost"
                          borderRadius="8px"
                          bg={idx === activeMentionIdx ? 'overlay.200' : 'transparent'}
                          onClick={() => applyMentionSuggestion(name)}
                          onMouseEnter={() => setActiveMentionIdx(idx)}
                        >
                          @{name}
                        </Button>
                      ))}
                    </VStack>
                  </Box>
                )}
                {isTabletLayout && (
                  <Text fontSize="10px" color="overlay.500" w="100%" px={1}>
                    Tip: type @ to mention someone in this conversation.
                  </Text>
                )}
                </Flex>
              )}
            </Flex>
          )}
        </Flex>
      </Box>
    </>
  );
}
