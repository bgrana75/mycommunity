// app/page.tsx
'use client';

import { Box, Container, Flex, Spinner } from '@chakra-ui/react';
import TweetList from '../../components/homepage/TweetList';
import TweetComposer from '../../components/homepage/TweetComposer';
import RightSidebar from '../../components/layout/RightSideBar';
import { useEffect, useState } from 'react';
import { Comment, Discussion } from '@hiveio/dhive'; // Ensure this import is consistent
import Conversation from '../../components/homepage/Conversation';
import TweetReplyModal from '../../components/homepage/TweetReplyModal';
import { getPost } from '@/lib/hive/client-functions';
import PostDetails from '@/app/components/blog/PostDetail';

interface PostPageProps {
  params: {
    slug: string | string[];
  };
}

export default function PostPage({ params }: PostPageProps) {

  const [isLoading, setIsLoading] = useState(false);
  const [post, setPost] = useState<Discussion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState<string>();
  const [permlink, setPermlink] = useState<string>();
  const [conversation, setConversation] = useState<Comment | undefined>();
  const [reply, setReply] = useState<Comment>();
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState<Comment | null>(null); // Define the state

  useEffect(() => {
    if (typeof params.slug === 'string' || !Array.isArray(params.slug)) {
      setError('Invalid URL');
      return;
    }

    const [author, permlink] = params.slug;
    setAuthor(author);
    setPermlink(permlink);

    async function loadPost() {
      setIsLoading(true);
      try {
        const post = await getPost(author, permlink);
        setPost(post);
      } catch (err) {
        setError('Failed to load post');
      } finally {
        setIsLoading(false);
      }
    }

    loadPost();
  }, [params.slug]);

  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);

  const handleNewComment = (newComment: Partial<Comment> | CharacterData) => {
    setNewComment(newComment as Comment); // Type assertion
  };

  if (isLoading || (!post || !author || !permlink)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  return (
    <Box bg="background" color="text" minH="100vh">
      <Flex direction={{ base: 'column', md: 'row' }}>
        <Box flex="1" p={4}>
          <Container maxW="container.sm">
            <PostDetails post={post} />
            {!conversation ? (
              <>
                <TweetComposer pa={author} pp={permlink} onNewComment={handleNewComment} post={true} />
                <TweetList
                  author={author}
                  permlink={permlink}
                  setConversation={setConversation}
                  onOpen={onOpen}
                  setReply={setReply}
                  newComment={newComment} // Pass the newComment to TweetList
                  post={true}
                />
              </>
            ) : (
              <Conversation comment={conversation} setConversation={setConversation} onOpen={onOpen} setReply={setReply} />
            )}
          </Container>
        </Box>
        <RightSidebar />
      </Flex>
      {isOpen && <TweetReplyModal isOpen={isOpen} onClose={onClose} comment={reply} onNewReply={handleNewComment} />}
    </Box>
  );
}
