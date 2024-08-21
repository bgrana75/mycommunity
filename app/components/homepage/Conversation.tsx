import { Box, Text, HStack, Button, Avatar, Link, Divider, IconButton } from '@chakra-ui/react';
import { Comment } from '@hiveio/dhive';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { useComments } from '@/hooks/useComments';
import { FaHeart, FaRegComment, FaRegHeart, FaShare, FaArrowLeft } from "react-icons/fa";
import { ArrowBackIcon } from "@chakra-ui/icons";
interface ConversationProps {
    comment: Comment;
}

const Conversation = ({ comment }: ConversationProps) => {

    const replies = useComments(comment.author, comment.permlink);

    function handleReplyModal() {
        // Handle the reply modal logic here
    }

    function onBackClick() {

    }

    return (
        <Box bg="muted" p={4} mt={1} mb={1} borderRadius="md">
            <HStack mb={4} spacing={2}>
                <Button onClick={onBackClick} variant="ghost" leftIcon={<ArrowBackIcon />}></Button>
                <Text fontSize="lg" fontWeight="bold">Conversation</Text>
            </HStack>
            <HStack mb={2}>
                <Avatar size="sm" name={comment.author} />
                <Link href={`/profile/${comment.author}`} fontWeight="bold" mb={2}>
                    {comment.author}
                </Link>
            </HStack>
            <MarkdownRenderer>{comment.body}</MarkdownRenderer>
            <HStack justify="space-between" mt={3}>
                <Button leftIcon={<FaRegHeart />} variant="ghost">{comment.net_votes}</Button>
                <Button leftIcon={<FaRegComment />} variant="ghost" onClick={handleReplyModal}>{replies.comments.length}</Button>
                <Button leftIcon={<FaShare />} variant="ghost"></Button>
            </HStack>
            <Divider my={4} />
            <HStack justify="space-between" mt={3}>
                <HStack>
                    <Avatar size="sm" name="Your Name" />
                    <Text>Tweet your reply</Text>
                </HStack>
                <Button variant="solid" colorScheme="primary" onClick={handleReplyModal}>
                    Reply
                </Button>
            </HStack>
            <Divider my={4} />
        </Box>
    );
}

export default Conversation;
