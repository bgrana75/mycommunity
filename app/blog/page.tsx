'use client'
import { Container, IconButton, Flex } from '@chakra-ui/react';
import { FaTh, FaBars, FaPen } from 'react-icons/fa'; 
import PostGrid from '../components/blog/PostGrid';
import { useState } from 'react';
import { useRouter } from 'next/navigation'; 
import usePosts from '@/hooks/usePosts';

export default function Blog() {
    const COMMUNITY_TAG = [{ 
        tag: process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG, 
        limit: 20 
    }];
    
    const [query, setQuery] = useState("created");
    const { posts } = usePosts(query, COMMUNITY_TAG);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');  // State for view toggle

    const router = useRouter();  // Initialize the router

    return (
        <Container maxW="container.lg" mt="3">
            <Flex justifyContent="flex-end" mb={4}>
                <IconButton
                    aria-label="Grid View"
                    icon={<FaTh />}  // Icon for grid view
                    onClick={() => setViewMode('grid')}
                    isActive={viewMode === 'grid'}
                    variant={viewMode === 'grid' ? 'solid' : 'outline'}  // Button style based on active view
                />
                <IconButton
                    aria-label="List View"
                    icon={<FaBars />}  // Icon for list view
                    onClick={() => setViewMode('list')}
                    isActive={viewMode === 'list'}
                    variant={viewMode === 'list' ? 'solid' : 'outline'}  // Button style based on active view
                    ml={4}  // Add margin between buttons
                />
                <IconButton
                    aria-label="Compose"
                    icon={<FaPen />}  // Icon for the compose action
                    onClick={() => router.push('/compose')}  // Redirect to the /compose page
                    variant="outline"  // Use theme's base styles
                    ml={4}
                />
            </Flex>
            {posts && (
                <PostGrid posts={posts} columns={viewMode === 'grid' ? 3 : 1} />
            )}
        </Container>
    );
}
