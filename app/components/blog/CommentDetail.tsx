import { Box, Text, HStack, Button, Avatar, Link, VStack } from '@chakra-ui/react';
import { Comment } from '@hiveio/dhive';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ExtendedComment } from '@/hooks/useComments';
import { FaRegComment, FaRegHeart, FaShare, FaHeart } from "react-icons/fa";
import { useAioha } from '@aioha/react-ui';
import useHiveAccount from '@/hooks/useHiveAccount';
import { useState } from 'react';

interface CommentDetailProps {
    comment: ExtendedComment;
    level?: number; // Added level for indentation
}

export default function CommentDetail ({ comment, level = 0 }: CommentDetailProps) {
    const { aioha, user } = useAioha();
    const userAccount = useHiveAccount(comment.author)
    const [voted, setVoted] = useState(comment.active_votes?.some(item => item.voter === user))

    const replies = comment.replies;

    async function handleVote() {
        const vote = await aioha.vote(comment.author, comment.permlink, 500);
        setVoted(vote.success)
    }

    return (
        <Box pl={level > 0 ? 1 : 0} ml={level > 0 ? 2 : 0}>
            <Box
                bg="muted"
                p={4}
                mt={2}
                mb={0}
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
                        <FaRegComment cursor="pointer" />

                            <Text cursor="pointer" fontWeight="bold">
                                {comment.children}
                            </Text>

                    </HStack>
                    <Button leftIcon={<FaShare />} variant="ghost"></Button>
                </HStack>
            </Box>
            {/* Render replies recursively */}
            {replies && replies.length > 0 && (
                <VStack spacing={0} align="stretch" mt={0}>
                    {replies.map((reply: Comment) => (
                        <CommentDetail
                            key={reply.permlink}
                            comment={reply}
                            level={level + 1} // Increment level for indentation
                        />
                    ))}
                </VStack>
            )}
        </Box>
    );
};
