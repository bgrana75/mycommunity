'use client'
import { Container, IconButton, Flex, Menu, MenuButton, MenuList, MenuItem, Button, Box, Spinner } from '@chakra-ui/react';
import { FaTh, FaBars, FaPen, FaSort } from 'react-icons/fa'; 
import PostGrid from '@/components/blog/PostGrid';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import InfiniteScroll from 'react-infinite-scroll-component';
import { Discussion } from '@hiveio/dhive';
import { findPosts } from '@/lib/hive/client-functions';

export default function Blog() {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); 
    const router = useRouter(); 
    const [query, setQuery] = useState("created");
    const [allPosts, setAllPosts] = useState<Discussion[]>([]);
    const isFetching = useRef(false);

    const tag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG

    const params = useRef([
        { 
            tag: tag, 
            limit: 12,
            start_author: '',
            start_permlink: '',
        }
    ])

    async function fetchPosts() {
        if (isFetching.current) return; // Prevent multiple fetches
        isFetching.current = true;
        try {
            const posts = await findPosts(query, params.current);
            setAllPosts(prevPosts => [...prevPosts, ...posts]);
            params.current = [{
                    tag: tag, 
                    limit: 12   ,
                    start_author: posts[posts.length - 1].author,
                    start_permlink: posts[posts.length - 1].permlink,
                }]               
            isFetching.current = false; 
        } catch (error) {
            console.log(error)
        }

    }

    useEffect(() => {
        fetchPosts();
    }, []);

    return (
        <Container maxW="container.lg" mt="3">
            <Flex justifyContent="space-between" mb={4}>
                <IconButton
                    aria-label="Compose"
                    icon={<FaPen />}  
                    onClick={() => router.push('/compose')}  
                    variant="outline"  
                />
                <Flex justifyContent="flex-end">
                    <IconButton
                        aria-label="Grid View"
                        icon={<FaTh />} 
                        onClick={() => setViewMode('grid')}
                        isActive={viewMode === 'grid'}
                        variant={viewMode === 'grid' ? 'solid' : 'outline'}  
                    />
                    <IconButton
                        aria-label="List View"
                        icon={<FaBars />}  
                        onClick={() => setViewMode('list')}
                        isActive={viewMode === 'list'}
                        variant={viewMode === 'list' ? 'solid' : 'outline'}
                        ml={4}
                    />
                    <Menu>
                        <MenuButton
                            as={Button}
                            aria-label="Sort Options"
                            leftIcon={<FaSort />} 
                            variant="outline"
                            ml={4}
                        >
                            Sort
                        </MenuButton>
                        <MenuList>
                            <MenuItem onClick={() => setQuery('created')}>Recent</MenuItem>
                            <MenuItem onClick={() => setQuery('trending')}>Trending</MenuItem>
                            <MenuItem onClick={() => setQuery('hot')}>Hot</MenuItem>
                        </MenuList>
                    </Menu>
                </Flex>
            </Flex>
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
                {allPosts && (<PostGrid posts={allPosts ?? []} columns={viewMode === 'grid' ? 3 : 1} />
            )}
            </InfiniteScroll>
        </Container>
    );
}
