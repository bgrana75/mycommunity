'use client'
import { Box, Text, HStack, Button, Avatar, Link } from '@chakra-ui/react';
import { Comment } from '@hiveio/dhive';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
//import DOMPurify from 'dompurify';
//import { useComments } from '@/hooks/useComments';
import { FaHeart, FaMoneyBill, FaRegComment, FaRegHeart, FaShare } from "react-icons/fa";

const Tweet = ({ comment }: { comment: Comment }) => {
    // Sanitize the comment body to remove any invalid HTML tags or attributes
    //const sanitizedBody = DOMPurify.sanitize//.sanitize(comment.body);
    const sanitizedBody = comment.body;
    
    const tweetLink = `https://peakd.com/@${comment.author}/${comment.permlink}`;

    return (
        <Box bg="muted" p={4} mt={1} mb={1} borderRadius="md" marginLeft={comment.depth*33}>
            <HStack mb={2}>
                <Avatar size="sm" name={comment.author} />
                <Text>{comment.title}</Text>
                <Link href={`/profile/${comment.author}`} fontWeight="bold" mb={2}>
                    {comment.author}
                </Link>
                <Text fontSize={'14px'}>{comment.created}</Text>
                <Link fontSize={'12px'}
                    href={tweetLink}
                    target='_blank'
                    >
                    {comment.permlink}
                </Link>
            </HStack>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
            >
                {sanitizedBody}
            </ReactMarkdown>
            <HStack justify="space-between" mt={3}>
                {/* <Button leftIcon={<FaHeart />} variant="ghost">{comment.net_votes}</Button> */}
                <Button leftIcon={<FaRegHeart />} variant="ghost">{comment.net_votes}</Button>
                <Button leftIcon={<FaRegComment />} variant="ghost">{comment.children}</Button>
                <Button leftIcon={<FaMoneyBill />} variant="ghost">{comment.total_payout_value.toString()}
            </Button>
            </HStack>
        </Box>
    );
}

export default Tweet;