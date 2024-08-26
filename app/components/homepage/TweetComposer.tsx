import React, { useState, useRef } from 'react';
import { Box, Textarea, HStack, Button, Image, IconButton, Wrap, Spinner, Progress } from '@chakra-ui/react';
import { useAioha } from '@aioha/react-ui';
import GiphySelector from './GiphySelector';
import ImageUploader from './ImageUploader';
import { IGif } from '@giphy/js-types';
import { CloseIcon } from '@chakra-ui/icons';
import { signImageHash } from '@/lib/hive/server-functions';
import crypto from 'crypto';

const parent_author_default = process.env.NEXT_PUBLIC_THREAD_AUTHOR || "skatedev";
const parent_permlink_default = process.env.NEXT_PUBLIC_THREAD_PERMLINK || "re-skatedev-sidr6t";

interface TweetComposerProps {
    pa?: string;
    pp?: string;
}
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

const TweetComposer: React.FC<TweetComposerProps> = ({ pa, pp }) => {
    const { aioha } = useAioha();
    const postBodyRef = useRef<HTMLTextAreaElement>(null);
    const [images, setImages] = useState<File[]>([]);
    const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
    const [isGiphyModalOpen, setGiphyModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

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

        // Update progress
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
            console.log(validUrls, 'validurls');

            if (validUrls.length > 0) {
                const imageMarkup = validUrls.map((url: string | null) => `![image](${url?.toString() || ''})`).join('\n');
                commentBody += `\n\n${imageMarkup}`;
            }
        }

        if (selectedGif) {
            commentBody += `\n\n![gif](${selectedGif.images.downsized_medium.url})`;
        }

        console.log(commentBody);

        if (commentBody) {
            try {
                const comment = await aioha.comment(pa, pp, permlink, '', commentBody, { app: 'mycommunity' });
                console.log(comment);
            } finally {
                setIsLoading(false);
                setUploadProgress(0);
            }
        }
    }

    const handleUploadImages = (newImages: File[]) => {
        setImages((prevImages) => [...prevImages, ...newImages]);
    };

    const handleRemoveImage = (index: number) => {
        setImages((prevImages) => prevImages.filter((_, i) => i !== index));
    };

    const handleRemoveGif = () => {
        setSelectedGif(null);
    };

    const handleGifSelect = (gif: IGif, e: React.SyntheticEvent<HTMLElement>) => {
        e.preventDefault();
        setSelectedGif(gif);
        setGiphyModalOpen(false);
    };

    return (
        <Box bg="muted" p={4} borderRadius="md" mb={3}>
            <Textarea
                placeholder="What's happening?"
                bg="background"
                borderColor="border"
                mb={3}
                ref={postBodyRef}
                _placeholder={{ color: 'text' }}
                isDisabled={isLoading}
            />
            <HStack justify="space-between" mb={3}>
                <HStack>
                    <Button as="label" variant="ghost" isDisabled={isLoading}>
                        Image
                        <ImageUploader images={images} onUpload={handleUploadImages} onRemove={handleRemoveImage} />
                    </Button>
                    <Button variant="ghost" onClick={() => setGiphyModalOpen(!isGiphyModalOpen)} isDisabled={isLoading}>Add GIF</Button>
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
                            onClick={() => handleRemoveImage(index)}
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
                            onClick={handleRemoveGif}
                            isDisabled={isLoading}
                        />
                    </Box>
                )}
            </Wrap>
            {isGiphyModalOpen && (
                <GiphySelector
                    apiKey={process.env.GIPHY_API_KEY || 'qXGQXTPKyNJByTFZpW7Kb0tEFeB90faV'}
                    onSelect={handleGifSelect}
                />
            )}
        </Box>
    );
};

export default TweetComposer;
