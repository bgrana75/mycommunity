// app/blog/page.tsx
'use client'
import { Container } from '@chakra-ui/react';
import PostGrid from '../components/blog/PostGrid';
import { useState } from 'react';
import usePosts from '@/hooks/usePosts';
//import dummyPosts from '../components/blog/dummyPosts';

export default function Blog() {

    const COMMUNITY_TAG = [{ tag: process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG, limit: 60 }]
    const [tag, setTag] = useState(COMMUNITY_TAG)
    const [query, setQuery] = useState("created")
    const { posts, error, isLoading, setQueryCategory, setDiscussionQuery } = usePosts(query, tag)

    return (
        <Container maxW="container.lg">
            {posts ? (
                <PostGrid posts={posts} columns={3} />
            ) : (
                <></>
            )}
        </Container>
    );
}
