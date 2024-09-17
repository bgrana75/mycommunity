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
      const threshold = 400; // Load more posts 100px before reaching the bottom
      if (scrollTop + clientHeight >= scrollHeight - threshold && !isLoading) {
        fetchPosts(); // Fetch more posts when the user is near the bottom
      }
    }
  };

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (sidebar) {
      sidebar.addEventListener('scroll', handleScroll); // Add scroll listener
      return () => sidebar.removeEventListener('scroll', handleScroll); // Cleanup on unmount
    }
  }, [isLoading]);

  return (
    <Box
      as="aside"
      w={{ base: '100%', md: '300px' }} // Adjust width for responsive layout
      h="100vh" // Full viewport height
      overflowY="auto" // Enable vertical scrolling
      pr={2} // Padding for content
      pt={2}
      position="sticky" // Stick to the viewport
      top={0} // Ensure it's stuck to the top when scrolling
      ref={sidebarRef} // Assign the ref to the sidebar div
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
