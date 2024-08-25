import React, { useState, useRef, useEffect } from 'react';
import { Box, Input, HStack, Button, Textarea, Image, IconButton, Wrap, Modal, ModalContent, ModalHeader, ModalCloseButton, Center } from '@chakra-ui/react';
import { useAioha } from '@aioha/react-ui';
import { CloseIcon } from '@chakra-ui/icons';
import crypto, { sign } from 'crypto';
import { signImageHash } from '@/lib/hive/server-functions';
import { Buffer } from 'buffer';
import { PrivateKey } from '@hiveio/dhive';
import { Grid } from '@giphy/react-components'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { IGif } from '@giphy/js-types'
import { Spinner } from '@chakra-ui/react';

const parent_author_default = process.env.NEXT_PUBLIC_THREAD_AUTHOR || "skatedev";
const parent_permlink_default = process.env.NEXT_PUBLIC_THREAD_PERMLINK || "re-skatedev-sidr6t";

interface TweetComposerProps {
    pa?: string;
    pp?: string;
}

export default function TweetComposer({ pa, pp }: TweetComposerProps) {
    const { aioha, user, provider } = useAioha();
    const postBodyRef = useRef<HTMLTextAreaElement>(null);
    const [images, setImages] = useState<File[]>([]);

    // TODO: Image Upload Organize 

    const getFileSignature = (file: File): Promise<string> => { // get signature for imagehoster
        return new Promise<string>(async (resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async () => {
                if (reader.result) {
                    const content = Buffer.from(reader.result as ArrayBuffer);
                    const hash = crypto.createHash('sha256')
                        .update('ImageSigningChallenge')
                        .update(content)
                        .digest('hex'); // Convert to hex string for transmission
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

    async function handleComment() {
        if (!pa || !pp) {
            pa = parent_author_default;
            pp = parent_permlink_default;
        }

        const permlink = new Date()
            .toISOString()
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase();

        let commentBody = postBodyRef.current?.value;
        if (images.length > 0) {
            const uploadedImages = await Promise.all(images.map(async (image) => {
                const content = await getFileSignature(image)
                try {
                    const uploadUrl = await uploadImage(image, content as string);
                    return uploadUrl;
                } catch (error) {
                    console.error('Error uploading image:', error);
                    return null;
                }
            }));

            const validUrls = uploadedImages.filter(Boolean);
            console.log(validUrls, 'validurls')

            if (validUrls.length > 0) {
                const imageMarkup = validUrls.map(url => `![image](${url})`).join('\n');
                commentBody += `\n\n${imageMarkup}`;
                ;
            }
        }
        if (selectedGif) {
            commentBody += `\n\n![gif](${selectedGif.images.downsized_medium.url})`;
        }
        console.log(commentBody)
        if (commentBody) {
            const comment = await aioha.comment(pa, pp, permlink, '', commentBody, { app: 'mycommunity' });
            console.log(comment);
        }
    }

    async function uploadImage(file: File, signature: string): Promise<string> {
        const formData = new FormData();
        formData.append("file", file, file.name);
        //formData.append("signature", signature);

        const response = await fetch('https://images.hive.blog/skatedev/' + signature, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Failed to upload image');
        }

        const result = await response.json();
        return result.url;
    }

    function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files || []);
        setImages(prevImages => [...prevImages, ...files]);
    }

    function handleRemoveImage(index: number) {
        setImages(prevImages => prevImages.filter((_, i) => i !== index));
    }

    // Giphy Stuff 
    const api_key = process.env.GIPHY_API_KEY || 'qXGQXTPKyNJByTFZpW7Kb0tEFeB90faV';
    const gf = new GiphyFetch(api_key);
    const [isGiphyModalOpen, setGiphyModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('skateboard funny');
    const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
    const [gifs, setGifs] = useState<IGif[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // This useEffect should fetch GIFs either trending or based on searchTerm
        const fetch = async () => {
            const { data } = searchTerm
                ? await gf.search(searchTerm, { limit: 10 })
                : await gf.trending({ limit: 10 });
            setGifs(data); // Set the fetched GIFs to state
        };

        fetch();
    }, [searchTerm]);
    const onGifSelect = (gif: IGif, e: any) => {
        e.preventDefault();
        setSelectedGif(gif);
        setGiphyModalOpen(false); // Close the modal after selection
    };

    const handleSearchTermChange = (value: string) => {
        setTimeout(() => {
            setSearchTerm(value);
        }, 5000);
        setIsLoading(false);
    };
    const GiphyModal = () => {
        return (
            isGiphyModalOpen && (
                <>
                    <Input
                        placeholder="Type to search..."
                        onChange={(e) => {
                            setIsLoading(true);
                            handleSearchTermChange(e.target.value);
                        }} // Directly set the searchTerm
                        m={4}

                    />
                    {isLoading && <Spinner />}
                    <Center>

                        <Grid
                            width={450}
                            columns={3}
                            fetchGifs={(offset: any) => gf.search(searchTerm, { offset, limit: 10 })}
                            onGifClick={onGifSelect}
                        />
                    </Center>
                </>
            )
        );
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
            />
            <HStack justify="space-between" mb={3}>
                <HStack>
                    <Button as="label" variant="ghost">
                        Image
                        <Input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleImageUpload}
                            hidden
                        />
                    </Button>
                    <Button variant="ghost" onClick={() => setGiphyModalOpen(!isGiphyModalOpen)}>Add GIF</Button>

                    {/* <Button variant="ghost">Poll</Button> */}
                </HStack>
                <Button variant="solid" colorScheme="primary" onClick={handleComment}>
                    Tweet
                </Button>
            </HStack>
            {(images.length > 0 || selectedGif) && (
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
                            />
                        </Box>
                    ))}
                    {selectedGif && (
                        <Box key={selectedGif.id} position="relative">
                            <Image alt="" src={selectedGif.images.downsized_medium.url} boxSize="100px" borderRadius="md" />
                            <IconButton
                                aria-label="Remove image"
                                icon={<CloseIcon />}
                                size="xs"
                                position="absolute"
                                top="0"
                                right="0"
                                onClick={() => setSelectedGif(null)}
                            />
                        </Box>
                    )}

                </Wrap>
            )}
            <GiphyModal />
        </Box>
    );
}
