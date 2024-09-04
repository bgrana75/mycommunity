'use client';
import React, { useState, useEffect } from 'react';
import { Box, Text, Spinner } from '@chakra-ui/react';
import { getPost } from '@/lib/hive/client-functions';
import { Discussion } from '@hiveio/dhive';
import PostDetail from '@/app/components/blog/PostDetail';

interface PostPageProps {
  params: {
    slug: string | string[]; // Allow both string and array of strings
  };
}

export default function PostPage({ params }: PostPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [post, setPost] = useState<Discussion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof params.slug === 'string' || !Array.isArray(params.slug)) {
      setError('Invalid URL');
      return;
    }

    const [user, postId] = params.slug;
    setUser(user);
    setPostId(postId);

    async function loadPost() {
      setIsLoading(true);
      try {
        const temp = await getPost(user, postId);
        setPost(temp);
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
    </Box>
  );
}
