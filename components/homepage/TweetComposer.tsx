import React, { useState, useRef } from 'react';
import { Box, Textarea, HStack, Button, Image, IconButton, Wrap, Spinner, Progress } from '@chakra-ui/react';
import { useAioha } from '@aioha/react-ui';
import GiphySelector from './GiphySelector';
import ImageUploader from './ImageUploader';
import { IGif } from '@giphy/js-types';
import { CloseIcon } from '@chakra-ui/icons';
import { FaImage } from 'react-icons/fa';
import { MdGif } from 'react-icons/md';
import { Comment } from '@hiveio/dhive';
import { getFileSignature, uploadImage } from '@/lib/hive/client-functions';

interface TweetComposerProps {
    pa: string;
    pp: string;
    onNewComment: (newComment: Partial<Comment>) => void;
    post?: boolean;
}

export default function TweetComposer ({ pa, pp, onNewComment, post = false }: TweetComposerProps) {
    const { user, aioha } = useAioha();
    const postBodyRef = useRef<HTMLTextAreaElement>(null);
    const [images, setImages] = useState<File[]>([]);
    const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
    const [isGiphyModalOpen, setGiphyModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number[]>([]);

    const buttonText = (post ? "Reply" : "Post")

    async function handleComment() {

        let commentBody = postBodyRef.current?.value || '';

        if (!commentBody.trim() && images.length === 0 && !selectedGif) {
            alert('Please enter some text, upload an image, or select a gif before posting.');
            return; // Do not proceed
        }

        setIsLoading(true);
        setUploadProgress([]);

        const permlink = new Date()
            .toISOString()
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase();

        if (images.length > 0) {
            const uploadedImages = await Promise.all(images.map(async (image, index) => {
                const signature = await getFileSignature(image);
                try {
                    const uploadUrl = await uploadImage(image, signature, index, setUploadProgress);
                    return uploadUrl;
                } catch (error) {
                    console.error('Error uploading image:', error);
                    return null;
                }
            }));

            const validUrls = uploadedImages.filter(Boolean);

            if (validUrls.length > 0) {
                const imageMarkup = validUrls.map((url: string | null) => `![image](${url?.toString() || ''})`).join('\n');
                commentBody += `\n\n${imageMarkup}`;
            }
        }

        if (selectedGif) {
            commentBody += `\n\n![gif](${selectedGif.images.downsized_medium.url})`;
        }

        if (commentBody) {
            try {
                const commentResponse = await aioha.comment(pa, pp, permlink, '', commentBody, { app: 'mycommunity' });
                if (commentResponse.success) {
                    postBodyRef.current!.value = '';
                    setImages([]);
                    setSelectedGif(null);

                    const newComment: Partial<Comment> = {
                        author: user, // Assuming `pa` is the current user's author name
                        permlink: permlink,
                        body: commentBody,
                    };

                    onNewComment(newComment); // Pass the actual Comment data
                }
            } finally {
                setIsLoading(false);
                setUploadProgress([]);
            }
        }
    }

    return (
        <Box bg="muted" p={4} mb={1} borderRadius="base" border="tb1">
            <Textarea
                placeholder="What's happening?"
                bg="background"
                border="tb1"
                borderRadius={'base'}
                mb={3}
                ref={postBodyRef}
                _placeholder={{ color: 'text' }}
                isDisabled={isLoading}
            />
            <HStack justify="space-between" mb={3}>
                <HStack>
                    <Button _hover={{ border: 'tb1' }} _active={{ border: 'tb1' }} as="label" variant="ghost" isDisabled={isLoading}>
                        <FaImage size={22} />
                        <ImageUploader images={images} onUpload={setImages} onRemove={(index) => setImages(prevImages => prevImages.filter((_, i) => i !== index))} />
                    </Button>
                    <Button _hover={{ border: 'tb1' }} _active={{ border: 'tb1' }} variant="ghost" onClick={() => setGiphyModalOpen(!isGiphyModalOpen)} isDisabled={isLoading}>
                        <MdGif size={48} />
                    </Button>
                </HStack>
                <Button variant="solid" colorScheme="primary" onClick={handleComment} isDisabled={isLoading}>
                    {isLoading ? <Spinner size="sm" /> : buttonText}
                </Button>
            </HStack>
            <Wrap spacing={4}>
                {images.map((image, index) => (
                    <Box key={index} position="relative">
                        <Image alt="" src={URL.createObjectURL(image)} boxSize="100px" borderRadius="base" />
                        <IconButton
                            aria-label="Remove image"
                            icon={<CloseIcon />}
                            size="xs"
                            position="absolute"
                            top="0"
                            right="0"
                            onClick={() => setImages(prevImages => prevImages.filter((_, i) => i !== index))}
                            isDisabled={isLoading}
                        />
                        <Progress value={uploadProgress[index]} size="xs" colorScheme="green" mt={2} />
                    </Box>
                ))}
                {selectedGif && (
                    <Box key={selectedGif.id} position="relative">
                        <Image alt="" src={selectedGif.images.downsized_medium.url} boxSize="100px" borderRadius="base" />
                        <IconButton
                            aria-label="Remove GIF"
                            icon={<CloseIcon />}
                            size="xs"
                            position="absolute"
                            top="0"
                            right="0"
                            onClick={() => setSelectedGif(null)}
                            isDisabled={isLoading}
                        />
                    </Box>
                )}
            </Wrap>
            {isGiphyModalOpen && (
                <GiphySelector
                    apiKey={process.env.GIPHY_API_KEY || 'qXGQXTPKyNJByTFZpW7Kb0tEFeB90faV'}
                    onSelect={(gif, e) => {
                        e.preventDefault();
                        setSelectedGif(gif);
                        setGiphyModalOpen(false);
                    }}
                />
            )}
        </Box>
    );
};

