// app/page.tsx
'use client';

import { Alert, AlertIcon, Box, Button, Flex, Spinner } from '@chakra-ui/react';
import PostSidebar from '@/components/blog/PostSidebar';
import SnapList from '../homepage/SnapList';
import SnapComposer from '../homepage/SnapComposer';
import { useEffect, useState } from 'react';
import { Comment, Discussion } from '@hiveio/dhive'; // Ensure this import is consistent
import Conversation from '../homepage/Conversation';
import SnapReplyModal from '../homepage/SnapReplyModal';
import { getPost } from '@/lib/hive/client-functions';
import PostDetails from '@/components/blog/PostDetails';
import { useComments } from '@/hooks/useComments';
import { useHiveUser } from '@/contexts/UserContext';
import { useSearchParams } from 'next/navigation';
import { useAuthorMuteGate } from '@/hooks/useAuthorMuteGate';
import MutedAuthorNotice from '@/components/shared/MutedAuthorNotice';
import SnapCastBar from '@/components/homepage/SnapCastBar';
import { useSnapCast } from '@/hooks/useSnapCast';
import { useUserSettings } from '@/hooks/useUserSettings';

interface PostPageProps {
  author: string
  permlink: string
}

export default function PostPage({ author, permlink }: PostPageProps) {
  const searchParams = useSearchParams();
  const isEmbedMode = searchParams.get('embed') === 'true';
  const { hiveUser } = useHiveUser();
  const muteGate = useAuthorMuteGate(author);

  const [isLoading, setIsLoading] = useState(false);
  const [post, setPost] = useState<Discussion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [conversation, setConversation] = useState<Comment | undefined>();
  const [reply, setReply] = useState<Comment>();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationRefreshTrigger, setConversationRefreshTrigger] = useState(0);

  // Only fetch comments if NOT in embed mode
  const data = useComments(isEmbedMode ? '' : author, isEmbedMode ? '' : permlink, !isEmbedMode, hiveUser?.name);
  const commentsData = {
    ...data,
    loadNextPage: () => {},
    hasMore: false,
  };

  const { settings } = useUserSettings();
  const [live, setLive] = useState(searchParams.get('snapcast') === '1');
  const snapCast = useSnapCast({
    author,
    permlink,
    enabled: live && !isEmbedMode,
    sound: settings.snapCastSound,
    updateComments: data.updateComments,
  });

  useEffect(() => {
    async function loadPost() {
      setIsLoading(true);
      setError(null);
      try {
        const post = await getPost(author, permlink);
        // Older nodes answer a missing post with an empty object.
        if (!post.author) setError('Post not found');
        else setPost(post);
      } catch (err) {
        // Current nodes throw "Post <author>/<permlink> does not exist".
        const missing = err instanceof Error && /does not exist|assert exception/i.test(err.message);
        setError(missing ? 'Post not found' : 'Failed to load post');
      } finally {
        setIsLoading(false);
      }
    }

    loadPost();
  }, [author, permlink, retry]);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const handleTopLevelComment = (partial: Partial<Comment>) => {
    const optimistic = {
      author: partial.author ?? '',
      permlink: partial.permlink ?? `optimistic-${Date.now()}`,
      body: partial.body ?? '',
      created: new Date().toISOString(),
      active_votes: [],
      children: 0,
      replies: [],
      parent_author: author,
      parent_permlink: permlink,
      pending_payout_value: '0.000 HBD',
      total_payout_value: '0.000 HBD',
      curator_payout_value: '0.000 HBD',
      net_votes: 0,
      json_metadata: '{}',
      title: '',
    } as unknown as Comment;
    snapCast.markOwnReply();
    data.addComment(optimistic);
    setTimeout(() => data.updateComments(), 3000);
  };

  const handleReply = (_partial: Partial<Comment>) => {
    snapCast.markOwnReply();
    setTimeout(() => {
      data.updateComments();
      setConversationRefreshTrigger(t => t + 1);
    }, 3000);
  };

  if (error && !post) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Alert status="error" borderRadius="md" variant="solid">
          <AlertIcon />
          {error}
          {error !== 'Post not found' && (
            <Button ml={4} size="sm" onClick={() => setRetry(n => n + 1)}>Retry</Button>
          )}
        </Alert>
      </Box>
    );
  }

  if (isLoading || muteGate.isChecking || (!post || !author || !permlink)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  if (muteGate.isMuted) {
    return (
      <MutedAuthorNotice
        author={author}
        canUnmute={muteGate.canUnmute}
        isRelationshipLoading={muteGate.isRelationshipLoading}
        isProcessing={muteGate.isProcessing}
        onUnmute={muteGate.unmute}
      />
    );
  }

  return (
    <Box bg="background" color="text" minH="100vh" p={isEmbedMode ? 2 : 4}>
      <Flex gap={6} align="flex-start">
        <Box flex="1" minW={0}>
          {/* While live, the post (e.g. the livestream embed) stays pinned above
              the scrolling replies, capped so it can't eat a phone screen. */}
          <Box
            {...(live && !isEmbedMode && !conversation
              ? { position: 'sticky', top: 0, zIndex: 10, bg: 'background', maxH: '40vh', overflowY: 'auto' }
              : {})}
          >
            <PostDetails
              post={post}
              isEmbedMode={isEmbedMode}
              commentCount={commentsData.isLoading ? undefined : commentsData.comments.length}
            />
          </Box>
          {!isEmbedMode && !conversation ? (
            <>
              <Box mt={3}>
                <SnapCastBar
                  author={author}
                  permlink={permlink}
                  live={live}
                  onToggle={() => setLive(l => !l)}
                  newCount={snapCast.newCount}
                  onShowNew={snapCast.scrollToTop}
                />
              </Box>
              <SnapComposer pa={author} pp={permlink} onNewComment={handleTopLevelComment} post={true} onClose={() => {}} />
              <SnapList
                author={author}
                permlink={permlink}
                setConversation={setConversation}
                onOpen={onOpen}
                setReply={setReply}
                post={true}
                data={commentsData}
                scrollableTargetId="app-scroll-container"
              />
            </>
          ) : !isEmbedMode && conversation ? (
            <Conversation comment={conversation} setConversation={setConversation} onOpen={onOpen} setReply={setReply} refreshTrigger={conversationRefreshTrigger} />
          ) : null}
        </Box>

        {!isEmbedMode && (
          <Box
            display={{ base: 'none', lg: 'flex' }}
            flexDir="column"
            w="300px"
            flexShrink={0}
            position="sticky"
            top={4}
            alignSelf="flex-start"
          >
            <PostSidebar author={author} permlink={permlink} />
          </Box>
        )}
      </Flex>
      {!isEmbedMode && isOpen && <SnapReplyModal isOpen={isOpen} onClose={onClose} comment={reply} onNewReply={handleReply} />}
    </Box>
  );
}
