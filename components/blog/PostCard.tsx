import { Box, Image, Text, Avatar, Flex, Icon, Slider, SliderTrack, SliderFilledTrack, SliderThumb, Button, Link } from '@chakra-ui/react';
import React, { useState, useEffect } from 'react';
import { Discussion } from '@hiveio/dhive';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/swiper-bundle.css';
import { FaHeart, FaComment, FaRegHeart } from 'react-icons/fa';
import { getPostDate } from '@/lib/utils/GetPostDate';
import { useAioha } from '@aioha/react-ui';
import { useRouter } from 'next/navigation';
import { getPayoutValue } from '@/lib/hive/client-functions';

interface PostCardProps {
    post: Discussion;
}

export default function PostCard({ post }: PostCardProps) {
    const { title, author, body, json_metadata, created } = post;
    const postDate = getPostDate(created);
    const metadata = JSON.parse(json_metadata);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [sliderValue, setSliderValue] = useState(100);
    const [showSlider, setShowSlider] = useState(false);
    const { aioha, user } = useAioha();
    const [voted, setVoted] = useState(post.active_votes?.some(item => item.voter === user));
    const router = useRouter();

    // **State to control how many images to show initially**
    const [visibleImages, setVisibleImages] = useState<number>(3); // Start with 3 images

    useEffect(() => {
        const images = extractImagesFromBody(body);
        if (images && images.length > 0) {
            setImageUrls(images);
        }
    }, [body]);

    function extractImagesFromBody(body: string): string[] {
        const markdownImageRegex = /!\[.*?\]\((.*?)\)/g;
        const htmlImageRegex = /<img\s+[^>]*src="([^"]*)"[^>]*>/g;
        const markdownMatches = Array.from(body.matchAll(markdownImageRegex)) as RegExpExecArray[];
        const htmlMatches = Array.from(body.matchAll(htmlImageRegex)) as RegExpExecArray[];
        const markdownImages = markdownMatches.map(match => match[1]);
        const htmlImages = htmlMatches.map(match => match[1]);
        return [...markdownImages, ...htmlImages];
    }

    function handleHeartClick() {
        setShowSlider(!showSlider);
    }

    async function handleVote() {
        const vote = await aioha.vote(post.author, post.permlink, sliderValue * 100);
        setVoted(vote.success);
        handleHeartClick();
    }

    function viewPost() {
        router.push('/@' + author + '/' + post.permlink);
    }

    // **Function to load more slides**
    function handleSlideChange(swiper: any) {
        // Check if user is reaching the end of currently visible images
        if (swiper.activeIndex === visibleImages - 1 && visibleImages < imageUrls.length) {
            setVisibleImages((prev) => Math.min(prev + 3, imageUrls.length)); // Load 3 more slides
        }
    }

    return (
        <Box
            boxShadow={'lg'}
            border="tb1"
            borderRadius="base"
            overflow="hidden"
            bg="muted"
            p={4}
            display="flex"
            flexDirection="column"
            justifyContent="space-between"
            height="100%"
        >
            <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center">
                    <Avatar size="sm" name={author} src={`https://images.hive.blog/u/${author}/avatar/sm`} />
                    <Box ml={3}>
                        <Text fontWeight="medium" fontSize="sm">
                            <Link href={`/@${author}`}>@{author}</Link>
                        </Text>
                        <Text fontSize="sm" color="secondary">
                            {postDate}
                        </Text>
                    </Box>
                </Flex>
            </Flex>

            {/* Content Section */}
            <Box flexGrow={1} mt={2} cursor="pointer">
                <Text fontWeight="bold" fontSize="lg" textAlign="left" onClick={viewPost}>
                    {title}
                </Text>
                {imageUrls.length > 0 && (
                    <Swiper
                        spaceBetween={10}
                        slidesPerView={1}
                        pagination={{ clickable: true }}
                        navigation={true}
                        modules={[Navigation, Pagination]}
                        onSlideChange={handleSlideChange} // Listen to slide changes
                    >
                        {imageUrls.slice(0, visibleImages).map((url, index) => (
                            <SwiperSlide key={index}>
                                <Box h="200px" w="100%">
                                    <Image
                                        src={url}
                                        alt={title}
                                        borderRadius="base"
                                        objectFit="cover"
                                        w="100%"
                                        h="100%"
                                        loading="lazy"
                                    />
                                </Box>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                )}
            </Box>

            {/* Vote and Stats Section */}
            <Box mt="auto">
                {showSlider ? (
                    <Flex mt={4} alignItems="center">
                        <Box width="100%" mr={2}>
                            <Slider
                                aria-label="slider-ex-1"
                                defaultValue={0}
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
                        <Button size="xs" onClick={handleVote} pl={5} pr={5}>Vote {sliderValue} %</Button>
                        <Button size="xs" onClick={handleHeartClick} ml={1}>X</Button>
                    </Flex>
                ) : (
                    <Flex mt={4} justifyContent="space-between" alignItems="center">
                        <Flex alignItems="center">
                            {voted ? (
                                <Icon as={FaHeart} onClick={handleHeartClick} cursor="pointer" />
                            ) : (
                                <Icon as={FaRegHeart} onClick={handleHeartClick} cursor="pointer" />
                            )}
                            <Text ml={2} fontSize="sm">
                                {post.active_votes.length}
                            </Text>
                            <Icon as={FaComment} ml={4} />
                            <Text ml={2} fontSize="sm">
                                {post.children}
                            </Text>
                        </Flex>
                        <Text fontWeight="bold" fontSize="sm">
                            ${getPayoutValue(post)}
                        </Text>
                    </Flex>
                )}
            </Box>
        </Box>
    );
}
