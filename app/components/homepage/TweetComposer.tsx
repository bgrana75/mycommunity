import React, { useState, useRef } from 'react';
import { Box, Textarea, HStack, Button, Image, IconButton, Wrap, Spinner, Progress } from '@chakra-ui/react';
import { useAioha } from '@aioha/react-ui';
import GiphySelector from './GiphySelector';
import ImageUploader from './ImageUploader';
import { IGif } from '@giphy/js-types';
import { CloseIcon } from '@chakra-ui/icons';
import { signImageHash } from '@/lib/hive/server-functions';
import crypto from 'crypto';
import { FaImage } from 'react-icons/fa';
import { MdGif } from 'react-icons/md';
import { Comment } from '@hiveio/dhive';

const parent_author_default = process.env.NEXT_PUBLIC_THREAD_AUTHOR || "skatedev";
const parent_permlink_default = process.env.NEXT_PUBLIC_THREAD_PERMLINK || "re-skatedev-sidr6t";

interface TweetComposerProps {
    pa?: string;
    pp?: string;
    onNewComment: (newComment: Partial<Comment>) => void;
}

const TweetComposer: React.FC<TweetComposerProps> = ({ pa, pp, onNewComment }) => {
    const { aioha } = useAioha();
    const postBodyRef = useRef<HTMLTextAreaElement>(null);
    const [images, setImages] = useState<File[]>([]);
    const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
    const [isGiphyModalOpen, setGiphyModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const getFileSignature = (file: File): Promise<string> => {
        return new Promise<string>(async (resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async () => {
                if (reader.result) {
                    const content = Buffer.from(reader.result as ArrayBuffer);
                    const hash = crypto.createHash('sha256')
                        .update('ImageSigningChallenge')
                        .update(content)
                        .digest('hex');
                    try {
                        const signature = await signImageHash(hash);
                        resolve(signature);
                    } catch (error) {
                        console.error('Error signing the hash:', error);
                        reject(error);
                    }
                } else {
                    reject(new Error('Failed to read file.'));
                }
            };
            reader.onerror = () => {
                reject(new Error('Error reading file.'));
            };
            reader.readAsArrayBuffer(file);
        });
    };

    async function uploadImage(file: File, signature: string, index: number): Promise<string> {
        const formData = new FormData();
        formData.append("file", file, file.name);
        formData.append("signature", signature);

        const response = await fetch('https://images.hive.blog/skatedev/' + signature, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Failed to upload image');
        }

        const result = await response.json();
        setUploadProgress((prevProgress) => prevProgress + (100 / images.length));

        return result.url;
    }

    async function handleComment() {
        setIsLoading(true);
        setUploadProgress(0);

        if (!pa || !pp) {
            pa = parent_author_default;
            pp = parent_permlink_default;
        }

        const permlink = new Date()
            .toISOString()
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase();

        let commentBody = postBodyRef.current?.value || '';

        if (images.length > 0) {
            const uploadedImages = await Promise.all(images.map(async (image, index) => {
                const content = await getFileSignature(image);
                try {
                    const uploadUrl = await uploadImage(image, content, index);
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
                        author: pa, // Assuming `pa` is the current user's author name
                        permlink: permlink,
                        body: commentBody,
                    };

                    onNewComment(newComment); // Pass the actual Comment data
                }
            } finally {
                setIsLoading(false);
                setUploadProgress(0);
            }
        }
    }

    return (
        <Box bg="muted" p={4} borderRadius="base" mb={3}>
            <Textarea
                placeholder="What's happening?"
                bg="background"
                borderColor="border"
                borderRadius={'base'}
                mb={3}
                ref={postBodyRef}
                _placeholder={{ color: 'text' }}
                isDisabled={isLoading}
            />
            <HStack justify="space-between" mb={3}>
                <HStack>
                    <Button _hover={{ borderColor: 'border', border: '1px solid' }} _active={{ borderColor: 'border' }} as="label" variant="ghost" isDisabled={isLoading}>
                        <FaImage size={22} />
                        <ImageUploader images={images} onUpload={setImages} onRemove={(index) => setImages(prevImages => prevImages.filter((_, i) => i !== index))} />
                    </Button>
                    <Button _hover={{ borderColor: 'border', border: '1px solid' }} _active={{ borderColor: 'border' }} variant="ghost" onClick={() => setGiphyModalOpen(!isGiphyModalOpen)} isDisabled={isLoading}>
                        <MdGif size={48} />
                    </Button>
                </HStack>
                <Button variant="solid" colorScheme="primary" onClick={handleComment} isDisabled={isLoading}>
                    {isLoading ? <Spinner size="sm" /> : 'Tweet'}
                </Button>
            </HStack>
            {isLoading && <Progress value={uploadProgress} size="xs" colorScheme="primary" mb={3} />}
            <Wrap spacing={4}>
                {images.map((image, index) => (
                    <Box key={index} position="relative">
                        <Image alt="" src={URL.createObjectURL(image)} boxSize="100px" borderRadius="md" />
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
                    </Box>
                ))}
                {selectedGif && (
                    <Box key={selectedGif.id} position="relative">
                        <Image alt="" src={selectedGif.images.downsized_medium.url} boxSize="100px" borderRadius="md" />
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

export default TweetComposer; // Corrected: Ensure proper export statement
