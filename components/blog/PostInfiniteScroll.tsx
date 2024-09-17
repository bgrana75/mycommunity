'use client';
import { Box, Spinner } from '@chakra-ui/react';
import InfiniteScroll from 'react-infinite-scroll-component';
import PostGrid from '@/components/blog/PostGrid';
import { Discussion } from '@hiveio/dhive';

interface PostsInfiniteScrollProps {
    allPosts: Discussion[];
    fetchPosts: () => Promise<void>;
    viewMode: 'grid' | 'list';
}

export default function PostsInfiniteScroll({ allPosts, fetchPosts, viewMode }: PostsInfiniteScrollProps) {
    return (
        <InfiniteScroll
            dataLength={allPosts.length} 
            next={fetchPosts}
            hasMore={true}
            loader={
                (<Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                    <Spinner size="xl" color="primary" />
                </Box>
                )}
        >
            {allPosts && (<PostGrid posts={allPosts ?? []} columns={viewMode === 'grid' ? 3 : 1} />)}
        </InfiniteScroll>
    );
}
