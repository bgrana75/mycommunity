'use client';
import React, { useState, useEffect } from 'react';
import { Box, Text, Spinner } from '@chakra-ui/react';
import { getPost } from '@/lib/hive/client-functions';
import { Discussion } from '@hiveio/dhive';
import PostDetail from '@/app/components/blog/PostDetail';
import CommentList from '@/app/components/blog/CommentList';

interface PostPageProps {
  params: {
    slug: string | string[];
  };
}

export default function PostPage({ params }: PostPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [post, setPost] = useState<Discussion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof params.slug === 'string' || !Array.isArray(params.slug)) {
      setError('Invalid URL');
      return;
    }

    const [author, postId] = params.slug;
    setAuthor(author);
    setPostId(postId);

    async function loadPost() {
      setIsLoading(true);
      try {
        const post = await getPost(author, postId);
        setPost(post);
      } catch (err) {
        setError('Failed to load post');
      } finally {
        setIsLoading(false);
      }
    }

    loadPost();
  }, [params.slug]);

  if (error) {
    return <Text>{error}</Text>;
  }

  if (isLoading || !post) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  return (
    <Box color="text" maxW="container.md" mx="auto" m={3}>
      <PostDetail post={post} />
      <CommentList author={post.author} permlink={post.permlink} />
    </Box>
  );
}
