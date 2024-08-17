// components/PostCard.tsx
import { Box, Image, Text } from '@chakra-ui/react';
import React from 'react';
import { Post } from '@/app/types/Posts';
// I have created a type for the posts in the app/types/Posts.ts file. but may be we can get from dhive or keychain sdk

interface PostCardProps {
    post: Post;
}

export default function PostCard({ post }: PostCardProps) {
    const { title, author, body, json_metadata, created } = post;
    const imageUrl = json_metadata?.image?.[0]; // Get the first image from the metadata

    return (
        <Box
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
            bg="muted"
            p={4}
        >
            {imageUrl && <Image src={imageUrl} alt={title} borderRadius="md" mb={4} />}
            <Text fontWeight="bold" fontSize="lg" mb={2}>
                {title}
            </Text>
            <Text fontSize="sm" color="gray.500" mb={2}>
                By @{author} on {new Date(created).toLocaleDateString()}
            </Text>
            <Text noOfLines={3}>{body}</Text>
        </Box>
    );
}
