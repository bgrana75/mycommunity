// components/PostCard.tsx
import { Box, Container, Image, Text } from '@chakra-ui/react';
import React from 'react';
import { Discussion } from '@hiveio/dhive';
//import { Post } from '@/app/types/Posts';
// I have created a type for the posts in the app/types/Posts.ts file. but may be we can get from dhive or keychain sdk

interface PostCardProps {
    post: Discussion;
}

export default function PostCard({ post }: PostCardProps) {
    const { title, author, body, json_metadata, created } = post;
    const metadata = JSON.parse(json_metadata)
    const imageUrl = metadata?.image?.[0]; // Get the first image from the metadata

    return (
        <Box
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg="muted"
            p={4}
        >
            <Box
                bg="primary"
                h={40}
                w="100%"
                mb={4}
                borderRadius={4}
            >
                {imageUrl &&
                    <Image src={imageUrl} alt={title} borderRadius="md" mb={4} objectFit="cover" w="100%" h="100%" />
                }
            </Box>
            <Text noOfLines={2} fontWeight="bold" fontSize="lg" mb={2}>
                {title}
            </Text>
            <Text fontSize="sm" color="gray.500" mb={2}>
                By @{author} on {new Date(created).toLocaleDateString()}
            </Text>
        </Box>
    );
}
