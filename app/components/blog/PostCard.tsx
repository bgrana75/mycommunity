import { Box, Image, Text } from '@chakra-ui/react';
import React, { useState, useEffect } from 'react';
import { Discussion } from '@hiveio/dhive';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/swiper-bundle.css';

interface PostCardProps {
    post: Discussion;
}

export default function PostCard({ post }: PostCardProps) {
    const { title, author, body, json_metadata, created } = post;
    const metadata = JSON.parse(json_metadata);
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    useEffect(() => {
        const images = extractImagesFromBody(body);
        if (images && images.length > 0) {
            setImageUrls(images);
        }
    }, [body]);

    function extractImagesFromBody(body: string): string[] {
        const regex = /!\[.*?\]\((.*?)\)/g;
        const matches = Array.from(body.matchAll(regex)) as RegExpExecArray[];
        return matches.map(match => match[1]);
    }

    return (
        <Box
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg="muted"
            p={4}
        >
            {imageUrls.length > 0 && (
                <Swiper
                    spaceBetween={10}
                    slidesPerView={1}
                    pagination={{ clickable: true }}
                    navigation={true}
                    modules={[Navigation, Pagination]}
                >
                    {imageUrls.map((url, index) => (
                        <SwiperSlide key={index}>
                            <Box h="200px" w="100%">
                                <Image
                                    src={url}
                                    alt={title}
                                    borderRadius="md"
                                    mb={4}
                                    objectFit="cover"
                                    w="100%"
                                    h="100%"

                                />
                            </Box>
                        </SwiperSlide>
                    ))}
                </Swiper>
            )}
            <Text noOfLines={2} fontWeight="bold" fontSize="lg" mb={2}>
                {title}
            </Text>
            <Text fontSize="sm" color="gray.500" mb={2}>
                By @{author} on {new Date(created).toLocaleDateString()}
            </Text>
        </Box>
    );
}
