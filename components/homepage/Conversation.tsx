import { Box, Text, HStack, Button, Avatar, Divider, VStack, Spinner } from '@chakra-ui/react';
import { Comment } from '@hiveio/dhive';
import { useComments, ExtendedComment } from '@/hooks/useComments';
import { useHiveUser } from '@/contexts/UserContext';
import { ArrowBackIcon, ArrowUpIcon } from "@chakra-ui/icons";
import Snap from './Snap';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSnapContainer, isWaveContainer } from '@/lib/utils/snapUtils';
import { getPayoutValue } from '@/lib/hive/client-functions';
import { useSnapCast } from '@/hooks/useSnapCast';
import { useUserSettings } from '@/hooks/useUserSettings';
import { hasSnapCastRequest, clearSnapCastRequest } from '@/lib/snapcast/intent';
import SnapCastBar from './SnapCastBar';

type SortOrder = 'new' | 'top';

interface ConversationProps {
    comment: Comment;
    setConversation: (conversation: Comment | undefined) => void;
    onOpen: () => void;
    setReply: (reply: Comment) => void;
    refreshTrigger?: number;
    /** A reply just posted to this thread's top snap, for instant local
     *  display — see handleReply in app/page.tsx for why this only covers
     *  replies to the top snap, not nested replies within the thread. */
    pendingReply?: ExtendedComment | null;
    /** Fired once pendingReply has been added locally, so the parent can
     *  clear it — otherwise closing and reopening this same thread later
     *  would re-inject (and duplicate) an already-confirmed reply. */
    onConsumedPendingReply?: () => void;
}

const Conversation = ({ comment, setConversation, onOpen, setReply, refreshTrigger, pendingReply, onConsumedPendingReply }: ConversationProps) => {
    const { hiveUser } = useHiveUser();
    const router = useRouter();
    const { comments, isLoading, error, updateComments, addComment } = useComments(comment.author, comment.permlink, true, hiveUser?.name);

    const { settings } = useUserSettings();
    const [live, setLive] = useState(() => hasSnapCastRequest(comment.author, comment.permlink));
    useEffect(() => { clearSnapCastRequest(); }, []);
    const snapCast = useSnapCast({
        author: comment.author,
        permlink: comment.permlink,
        enabled: live,
        sound: settings.snapCastSound,
        updateComments,
    });
    const { markOwnReply } = snapCast;

    useEffect(() => {
        if (pendingReply) {
            markOwnReply();
            addComment(pendingReply);
            onConsumedPendingReply?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingReply]);
    // A "top snap" (or top wave) replies directly to its container; hide its parent
    // link so users can't open the container and load hundreds of replies at once.
    const isTopLevel = !comment.parent_author ||
        isSnapContainer(comment.parent_author, comment.parent_permlink) ||
        isWaveContainer(comment.parent_author, comment.parent_permlink);
    const [sortOrder, setSortOrder] = useState<SortOrder>('new');

    // updateComments also changes identity whenever the thread's muted tags
    // change (see useComments), which already triggers its own internal
    // refetch — so this effect must fire only on a genuine refreshTrigger
    // bump, not on every identity change of updateComments, or a reply
    // anywhere in the session would cause a duplicate fetch on every later
    // thread open.
    const lastRefreshTrigger = useRef(refreshTrigger);
    useEffect(() => {
        if (refreshTrigger !== lastRefreshTrigger.current) {
            lastRefreshTrigger.current = refreshTrigger;
            markOwnReply();
            if (refreshTrigger && refreshTrigger > 0) updateComments();
        }
    }, [refreshTrigger, updateComments, markOwnReply]);

    // A live thread is always newest-first so new snaps land right under the
    // parent instead of being ranked somewhere out of view.
    const effectiveSort: SortOrder = live ? 'new' : sortOrder;
    const replies = useMemo(() => {
        return [...comments].sort((a, b) => {
            if (effectiveSort === 'top') {
                return parseFloat(getPayoutValue(b)) - parseFloat(getPayoutValue(a));
            }
            return new Date(b.created).getTime() - new Date(a.created).getTime();
        });
    }, [comments, effectiveSort]);

    function handleReplyModal() {
        setReply(comment);
        onOpen();
    }

    function onBackClick() {
        setConversation(undefined)
    }

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Leave Escape to any open modal/popover/input that already owns it.
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            if (document.querySelector('[role="dialog"]')) return;
            const tag = (e.target as HTMLElement | null)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            setConversation(undefined);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [setConversation]);

    if (isLoading) {
        return (
            <Box textAlign="center" mt={4}>
                <Spinner size="xl" />
                <Text>Loading snaps...</Text>
            </Box>
        );
    }

    return (
        <Box bg="muted" p={4} mt={1} mb={1} borderRadius="base" border="tb1" boxShadow="lg">
            <HStack mb={4} spacing={2}>
                <Button onClick={onBackClick} variant="ghost" leftIcon={<ArrowBackIcon />}></Button>
                <Text fontSize="lg" fontWeight="bold">Conversation</Text>
            </HStack>
            {!isTopLevel && (
                <HStack
                    mb={2}
                    px={1}
                    spacing={1}
                    fontSize="sm"
                    color="gray.500"
                    cursor="pointer"
                    _hover={{ color: 'primary' }}
                    onClick={() => router.push(`/@${comment.parent_author}/${comment.parent_permlink}`)}
                >
                    <ArrowUpIcon boxSize={3} />
                    <Text>Replying to @{comment.parent_author}</Text>
                </HStack>
            )}
            <SnapCastBar
                author={comment.author}
                permlink={comment.permlink}
                live={live}
                onToggle={() => setLive(l => !l)}
                newCount={snapCast.newCount}
                onShowNew={snapCast.scrollToTop}
            />
            {/* While live the parent (e.g. the livestream embed) stays pinned
                above the scrolling replies; capped so it can't eat a phone. */}
            <Box
                {...(live ? { position: 'sticky', top: 0, zIndex: 10, bg: 'muted', maxH: '40vh', overflowY: 'auto' } : {})}
            >
                <Snap comment={comment} onOpen={onOpen} setReply={setReply} />
            </Box>
            <Divider my={4} />
            <HStack justify="space-between" mt={3} onClick={handleReplyModal}>
                <HStack>
                    <Avatar size="sm" name="Your Name" />
                    <Text>Snap your reply</Text>
                </HStack>
                <Button
                    onClick={handleReplyModal}
                    borderRadius="full"
                    px={6}
                    bg="#2d5278"
                    color="white"
                    fontWeight="semibold"
                    _hover={{ bg: '#356090' }}
                    _active={{ bg: '#244466' }}
                >
                    Reply
                </Button>
            </HStack>
            <Divider my={4} />
            {!live && replies.length > 1 && (
                <HStack spacing={2} mb={3}>
                    {(['new', 'top'] as const).map(opt => (
                        <Button
                            key={opt}
                            size="sm"
                            variant="ghost"
                            borderRadius="full"
                            bg={sortOrder === opt ? 'muted' : 'transparent'}
                            color={sortOrder === opt ? 'text' : 'gray.500'}
                            borderWidth="1px"
                            borderColor={sortOrder === opt ? 'primary' : 'border'}
                            _hover={{ bg: 'muted', color: 'text' }}
                            onClick={() => setSortOrder(opt)}
                        >
                            {opt === 'new' ? '✨ New' : '💰 Top'}
                        </Button>
                    ))}
                </HStack>
            )}
            <VStack spacing={2} align="stretch">
                {replies.map((reply: any) => (
                    <Snap key={reply.permlink} comment={reply} onOpen={onOpen} setReply={setReply} />
                ))}
            </VStack>
        </Box>
    );
}

export default Conversation;
