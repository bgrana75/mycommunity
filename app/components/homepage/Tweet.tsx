import { Box, Text, HStack, Button, Avatar, Link, VStack } from '@chakra-ui/react';
import { Comment } from '@hiveio/dhive';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ExtendedComment } from '@/hooks/useComments';
import { FaRegComment, FaRegHeart, FaShare, FaHeart } from "react-icons/fa";
import { useAioha } from '@aioha/react-ui';
import useHiveAccount from '@/hooks/useHiveAccount';
import { useState } from 'react';

interface TweetProps {
    comment: ExtendedComment;
    onOpen: () => void;
    setReply: (comment: Comment) => void;
    setConversation?: (conversation: Comment) => void;
    level?: number; // Added level for indentation
}

const Tweet = ({ comment, onOpen, setReply, setConversation, level = 0 }: TweetProps) => {
    const { aioha, user } = useAioha();
    const userAccount = useHiveAccount(comment.author)
    const [voted, setVoted] = useState(comment.active_votes?.some(item => item.voter === user))

    const replies = comment.replies;

    function handleReplyModal() {
        setReply(comment);
        onOpen();
    }

    function handleConversation() {
        if (setConversation) setConversation(comment);
    }

    async function handleVote() {
        const vote = await aioha.vote(comment.author, comment.permlink, 500);
        setVoted(vote.success)
    }

    return (
        <Box pl={level > 0 ? 4 : 0} ml={level > 0 ? 8 : 0}>
            <Box
                bg="muted"
                p={4}
                mt={1}
                mb={1}
                border="1px solid"
                borderColor="border"
                borderRadius="base"  // This will apply the borderRadius from your theme
            >
                <HStack mb={2}>
                    <Avatar size="sm" name={comment.author} src={userAccount.hiveAccount?.metadata?.profile.profile_image} />
                    <Link href={`/profile/${comment.author}`} fontWeight="bold" mb={2}>
                        {comment.author}
                    </Link>
                </HStack>
                <MarkdownRenderer>{comment.body}</MarkdownRenderer>
                <HStack justify="space-between" mt={3}>
                    <Button leftIcon={voted ? (<FaHeart />) : (<FaRegHeart />)} variant="ghost" onClick={handleVote}>
                        {comment.active_votes?.length}
                    </Button>
                    <HStack>
                        <FaRegComment onClick={handleReplyModal} cursor="pointer" />
                        {setConversation && (
                            <Text onClick={handleConversation} cursor="pointer" fontWeight="bold">
                                {comment.children}
                            </Text>
                        )}
                    </HStack>
                    <Button leftIcon={<FaShare />} variant="ghost"></Button>
                </HStack>
            </Box>
            {/* Render replies recursively */}
            {replies && replies.length > 0 && (
                <VStack spacing={2} align="stretch" mt={2}>
                    {replies.map((reply: Comment) => (
                        <Tweet
                            key={reply.permlink}
                            comment={reply}
                            onOpen={onOpen}
                            setReply={setReply}
                            setConversation={setConversation}
                            level={level + 1} // Increment level for indentation
                        />
                    ))}
                </VStack>
            )}
        </Box>
    );
};

export default Tweet;
