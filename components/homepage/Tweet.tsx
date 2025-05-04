import { Box, Text, HStack, Button, Avatar, Link, VStack, Flex, Slider, SliderTrack, SliderFilledTrack, SliderThumb } from '@chakra-ui/react';
import { Comment } from '@hiveio/dhive';
import { ExtendedComment } from '@/hooks/useComments';
import { FaRegComment, FaRegHeart, FaShare, FaHeart } from "react-icons/fa";
import { useAioha } from '@aioha/react-ui';
import { useState, useEffect } from 'react';
import { getPayoutValue, calculateUserVoteValue } from '@/lib/hive/client-functions';
import markdownRenderer from '@/lib/utils/MarkdownRenderer';
import { getPostDate } from '@/lib/utils/GetPostDate';
import useHiveAccount from '@/hooks/useHiveAccount';

interface TweetProps {
    comment: ExtendedComment;
    onOpen: () => void;
    setReply: (comment: Comment) => void;
    setConversation?: (conversation: Comment) => void;
    level?: number; // Added level for indentation
}

const Tweet = ({ comment, onOpen, setReply, setConversation, level = 0 }: TweetProps) => {
    const commentDate = getPostDate(comment.created);
    const { aioha, user } = useAioha();
    const { hiveAccount } = useHiveAccount(user || ''); // Ensure user is defined
    const [voted, setVoted] = useState(comment.active_votes?.some(item => item.voter === user))
    const [sliderValue, setSliderValue] = useState(5);
    const [showSlider, setShowSlider] = useState(false);
    const [rewardAmount, setRewardAmount] = useState(getPayoutValue(comment));

    const calculateVotingPower = () => {
        if (!hiveAccount || !hiveAccount.voting_manabar) return 0;
        const { voting_manabar, voting_power } = hiveAccount;
        const elapsedTime = (Date.now() / 1000) - voting_manabar.last_update_time;
        const regeneratedMana = elapsedTime * 10000 / 432000; // 432000 seconds in 5 days
        const currentMana = Math.min(Number(voting_manabar.current_mana) + regeneratedMana, 10000); // Ensure current_mana is a number
        return (currentMana / 10000) * voting_power;
    };

    const currentVotingPower = calculateVotingPower();

    useEffect(() => {
        const logVotingValue = async () => {
            if (hiveAccount) {
                const votingValue = await calculateUserVoteValue(hiveAccount);
                console.log(`Current Voting Value in HBD: ${votingValue}`);
            }
        };
        logVotingValue();
    }, [hiveAccount]);

    const replies = comment.replies;

    function handleHeartClick() {
        setShowSlider(!showSlider);
    }

    function handleReplyModal() {
        setReply(comment);
        onOpen();
    }

    function handleConversation() {
        if (setConversation) setConversation(comment);
    }
    console.log(`Current Voting Power: ${currentVotingPower}`); // Log the calculated voting power
    async function handleVote() {
        const votingValue = await calculateUserVoteValue(hiveAccount);
        console.log(`Voting Value: ${votingValue}`);
        console.log(`Slider Value: ${sliderValue}`);
        const newRewardAmount = parseFloat(rewardAmount) + (votingValue * (sliderValue / 100));
        console.log(`Previous Reward Amount: ${rewardAmount}`);
        console.log(`New Reward Amount: ${newRewardAmount}`);

        const vote = await aioha.vote(comment.author, comment.permlink, sliderValue * 100);
        if (vote.success) {
            setVoted(true);
            setRewardAmount(newRewardAmount.toFixed(3)); // Update reward amount optimistically
        }
        handleHeartClick();
    }
    return (
        <Box pl={level > 0 ? 1 : 0} ml={level > 0 ? 2 : 0}>
            <Box
                bg="muted"
                p={4}
                mt={1}
                mb={1}
                border="tb1"
                borderRadius="base"  // This will apply the borderRadius from your theme
                width="100%"
            >
                <HStack mb={2}>
                    <Avatar size="sm" name={comment.author} src={`https://images.hive.blog/u/${comment.author}/avatar/sm`} />
                    <Box ml={3}>
                        <Text fontWeight="medium" fontSize="sm">
                            <Link href={`/@${comment.author}`}>@{comment.author}</Link>
                        </Text>
                        <Text fontWeight="medium" fontSize="sm" color="primary">
                            {commentDate}
                        </Text>
                    </Box>
                </HStack>
                <Box dangerouslySetInnerHTML={{ __html: markdownRenderer(comment.body) }} />
                {showSlider ? (
                    <Flex mt={4} alignItems="center">
                        <Box width="100%" mr={2}>
                            <Slider
                                aria-label="slider-ex-1"
                                min={0}
                                max={100}
                                value={sliderValue}
                                onChange={(val) => setSliderValue(val)}
                            >
                                <SliderTrack>
                                    <SliderFilledTrack />
                                </SliderTrack>
                                <SliderThumb />
                            </Slider>
                        </Box>
                        <Button size="xs" onClick={handleVote}>&nbsp;&nbsp;&nbsp;Vote {sliderValue} %&nbsp;&nbsp;&nbsp;</Button>
                        <Button size="xs" onClick={handleHeartClick} ml={2}>X</Button>
                    </Flex>
                ) : (
                    <HStack justify="space-between" mt={3}>
                        <Button leftIcon={voted ? (<FaHeart />) : (<FaRegHeart />)} variant="ghost" onClick={handleHeartClick}>
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
                        <Text fontWeight="bold" fontSize="sm">
                            ${rewardAmount}
                        </Text>
                    </HStack>
                )}
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
