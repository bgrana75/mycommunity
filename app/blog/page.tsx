// app/blog/page.tsx
import { Container } from '@chakra-ui/react';
import PostGrid from '../components/blog/PostGrid';
import dummyPosts from '../components/blog/dummyPosts';

export default function Blog() {
    return (
        <Container maxW="container.lg">
            <PostGrid posts={dummyPosts} columns={3} />
        </Container>
    );
}
