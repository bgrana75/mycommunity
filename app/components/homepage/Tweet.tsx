// components/homepage/Tweet.tsx
import { Box, Text, HStack, Button } from '@chakra-ui/react';
import { Comment } from '@hiveio/dhive';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
const Tweet = ({ comment }: { comment: Comment }) => {
    return (
        <Box bg="muted" p={4} m={2} borderRadius="md">
            <Text fontWeight="bold" mb={2}>
                {comment.author}
            </Text>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
            >
                {comment.body}
            </ReactMarkdown>
            <HStack justify="space-between" mt={3}>
                <Button variant="ghost">Like</Button>
                <Button variant="ghost">Comment</Button>
                <Button variant="ghost">Share</Button>
            </HStack>
        </Box>
    );
}

export default Tweet;