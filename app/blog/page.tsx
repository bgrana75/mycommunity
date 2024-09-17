// pages/blog.tsx

'use client';
import { Container } from '@chakra-ui/react';
import { useState, useRef, useEffect } from 'react';
import { Discussion } from '@hiveio/dhive';
import { findPosts } from '@/lib/hive/client-functions';
import TopBar from '@/components/blog/TopBar';
import PostInfiniteScroll from '@/components/blog/PostInfiniteScroll';

export default function Blog() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [query, setQuery] = useState("created");
    const [allPosts, setAllPosts] = useState<Discussion[]>([]);
    const isFetching = useRef(false);

    const tag = 'hivebr';

    const params = useRef([
        { 
            tag: tag, 
            limit: 12,
            start_author: '',
            start_permlink: '',
        }
    ]);

    async function fetchPosts() {
        if (isFetching.current) return; // Prevent multiple fetches
        isFetching.current = true;
        try {
            const posts = await findPosts(query, params.current);
            setAllPosts(prevPosts => [...prevPosts, ...posts]);
            params.current = [{
                    tag: tag, 
                    limit: 12,
                    start_author: posts[posts.length - 1].author,
                    start_permlink: posts[posts.length - 1].permlink,
                }];
            isFetching.current = false; 
        } catch (error) {
            console.log(error);
        }
    }

    useEffect(() => {
        fetchPosts();
    }, [query]);

    return (
        <Container maxW="container.lg" mt="3">
            <TopBar viewMode={viewMode} setViewMode={setViewMode} setQuery={setQuery} />
            <PostInfiniteScroll allPosts={allPosts} fetchPosts={fetchPosts} viewMode={viewMode} />
        </Container>
    );
}
