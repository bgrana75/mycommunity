'use client';
import { Box, Spinner } from '@chakra-ui/react';
import { useState, useRef, useEffect } from 'react';
import { Discussion } from '@hiveio/dhive';
import { findPosts } from '@/lib/hive/client-functions';
import PostInfiniteScroll from '@/components/blog/PostInfiniteScroll';

export default function RightSideBar() {
  const [query, setQuery] = useState('created');
  const [allPosts, setAllPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null); // Reference for the sidebar
  const isFetching = useRef(false);

  const tag = process.env.NEXT_PUBLIC_HIVE_SEARCH_TAG

  const params = useRef([
    {
      tag: tag,
      limit: 8,
      start_author: '',
      start_permlink: '',
    },
  ]);

  async function fetchPosts() {
    if (isFetching.current) return; // Prevent multiple fetches
    isFetching.current = true;
    setIsLoading(true); // Set loading state
    try {
      const posts = await findPosts(query, params.current);
      setAllPosts((prevPosts) => [...prevPosts, ...posts]);
      params.current = [
        {
          tag: tag,
          limit: 8,
          start_author: posts[posts.length - 1]?.author,
          start_permlink: posts[posts.length - 1]?.permlink,
        },
      ];
    } catch (error) {
      console.log(error);
    } finally {
      isFetching.current = false;
      setIsLoading(false); // Reset loading state
    }
  }

  useEffect(() => {
    fetchPosts();
  }, [query]);

  // Scroll event handler
  const handleScroll = () => {
    const sidebar = sidebarRef.current;
    if (sidebar) {
      const { scrollTop, scrollHeight, clientHeight } = sidebar;
      const threshold = 400; 
      if (scrollTop + clientHeight >= scrollHeight - threshold && !isLoading) {
        fetchPosts(); 
      }
    }
  };

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener('scroll', handleScroll); 
      return () => sidebar.removeEventListener('scroll', handleScroll); 
    }
  }, [isLoading]);

  return (
    <Box
      as="aside"
      w={{ base: '100%', md: '350px' }} 
      h="100vh" 
      overflowY="auto" 
      pr={2} 
      pt={2}
      position="sticky" 
      top={0} 
      ref={sidebarRef} 
    >
      <PostInfiniteScroll allPosts={allPosts} fetchPosts={fetchPosts} viewMode="list" />
      {isLoading && (
        <Box display="flex" justifyContent="center" alignItems="center" mt={4}>
          <Spinner size="lg" />
        </Box>
      )}
    </Box>
  );
}
