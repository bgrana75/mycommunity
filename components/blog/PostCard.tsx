import { Box, Text, Flex, Link, Spinner } from '@chakra-ui/react';
import { extractMarkdownImages } from '@/lib/images/markdownImages';
import { Avatar } from '@/components/shared/Avatar';
import { MoodBadgeIcon } from '@/components/shared/MoodBadgeIcon';
import { useMoodBadges } from '@/hooks/useMoodBadges';
import React, { useState, useEffect, useMemo } from 'react';
import { Discussion } from '@hiveio/dhive';
import dynamic from 'next/dynamic';
import { getPostDate } from '@/lib/utils/GetPostDate';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import InteractionBar from '@/components/shared/InteractionBar';
import TopicSearchBadge from '@/components/shared/TopicSearchBadge';
import type { PostDiscoveryReason } from '@/lib/discovery/postInterestPool';
import { decodeHtmlEntities } from '@/lib/utils/htmlEntities';

interface PostCardProps {
    post: Discussion & { discoveryReason?: PostDiscoveryReason };
    compact?: boolean;
}

/** Fixed preview height — cards must not grow with portrait images or grid row stretch. */
const CARD_IMAGE_HEIGHT = '200px';

const PostCardCarousel = dynamic(() => import('./PostCardCarousel'), { ssr: false });

export default function PostCard({ post, compact = false }: PostCardProps) {
    const { title, author, body, json_metadata, created } = post;
    const postDate = getPostDate(created);
    const metadata = useMemo(() => (
        typeof json_metadata === 'object' && json_metadata !== null
            ? json_metadata
            : (() => { try { return JSON.parse(json_metadata || '{}'); } catch { return {}; } })()
    ), [json_metadata]);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const safeBody = typeof body === 'string' ? body : '';
    const postHref = `/@${encodeURIComponent(author || '')}/${encodeURIComponent(post.permlink || '')}`;
    const router = useRouter();
    const [isNavigating, setIsNavigating] = useState(false);
    const { getEquippedBadge } = useMoodBadges();

    function navigateToPost(e: React.MouseEvent) {
        e.preventDefault();
        setIsNavigating(true);
        router.push(postHref);
    }
    // Plain-text excerpt — strips markdown/HTML markup rather than just
    // hiding image/link syntax, matching the mobile app's BlogCard
    // (hivesnaps/app/components/BlogCard.tsx:buildExcerpt) so the same post
    // doesn't show stray `#`/`**`/`` ` ``/`>` characters here that mobile
    // already cleans up. Also strips bare (non-markdown) URLs and
    // `---`/`***` horizontal-rule dividers — neither the web nor mobile
    // regex handled these, and video-embed posts (e.g. a raw 3speak embed
    // link followed by "---") rendered the raw link right in the excerpt,
    // confirmed live. The image/link regexes tolerate stray whitespace
    // around `!`/`[`/`]`/`(` — real post bodies aren't always clean
    // `![alt](url)`; a "! [alt] (url)" variant (space after `!`, space
    // before `(`) was found live and broke the tighter version of this
    // regex, leaking the raw markdown fragment into the excerpt. Also
    // strips markdown table pipes (`|`) — a post built around a table
    // (e.g. an image gallery laid out as `| ![img](url) |` rows) otherwise
    // leaves literal `|` characters and `| - |` separator-row artifacts in
    // the excerpt once the cell contents themselves are stripped away.
    const strippedSnippet = safeBody
        .replace(/<[^>]*>/g, ' ')
        .replace(/!\s*\[[^\]]*]\s*\([^)]*\)/g, ' ')
        .replace(/\[([^\]]+)\]\s*\(([^)]*)\)/g, '$1')
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[-*_]{3,}/g, ' ')
        .replace(/\|/g, ' ')
        .replace(/#{1,6}\s*/g, '')
        .replace(/[*_~`>]/g, '');
    const snippet = decodeHtmlEntities(strippedSnippet).replace(/\s+/g, ' ').trim();

    // **State to control how many images to show initially**
    const [visibleImages, setVisibleImages] = useState<number>(3); // Start with 3 images

    useEffect(() => {
        const images = extractImagesFromBody(body);
        if (images && images.length > 0) {
            setImageUrls(images);
        } else {
            const metaImages = Array.isArray(metadata?.image)
                ? metadata.image.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
                : [];
            if (metaImages.length > 0) setImageUrls(metaImages);
        }
    }, [body, metadata]);

    function extractImagesFromBody(rawBody: unknown): string[] {
        if (typeof rawBody !== 'string' || !rawBody) return [];

        const markdownImages = extractMarkdownImages(rawBody)
            .map((img) => img.url)
            .filter((url) => /^https?:\/\//i.test(url));
        const htmlImages = Array.from(rawBody.matchAll(/<img\s+[^>]*src=["']([^"']*)["'][^>]*>/gi))
            .map((match) => match[1]);
        return [...markdownImages, ...htmlImages];
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
            boxShadow="md"
            border="tb1"
            borderRadius="10px"
            overflow="hidden"
            bg="surface"
            p={4}
            display="flex"
            flexDirection="column"
            backdropFilter="blur(16px)"
            transition="all 0.18s ease"
            _hover={{ transform: 'translateY(-2px)', boxShadow: 'lg', borderColor: 'rgba(28, 161, 241, 0.34)' }}
            position="relative"
            opacity={isNavigating ? 0.7 : 1}
        >
            {isNavigating && (
                <Box
                    position="absolute"
                    inset={0}
                    zIndex={10}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    borderRadius="10px"
                    pointerEvents="none"
                >
                    <Spinner color="primary" size="lg" />
                </Box>
            )}
            <Flex justifyContent="space-between" alignItems="center">
                <Flex alignItems="center">
                    <Avatar
                        size="sm"
                        username={author}
                        overlay={
                            getEquippedBadge(author)
                                ? <MoodBadgeIcon sku={getEquippedBadge(author)!} username={author} size="16px" />
                                : undefined
                        }
                    />
                    <Box ml={3}>
                        <Text fontWeight="medium" fontSize="sm">
                            <Link as={NextLink} href={`/@${author}`}>@{author}</Link>
                        </Text>
                        <Text fontSize="sm" color="primary">
                            {postDate}
                        </Text>
                    </Box>
                </Flex>
                {post.discoveryReason === 'topic-search' && <TopicSearchBadge />}
            </Flex>

            {/* Content Section */}
            <Box display="flex" flexDirection="column" mt={3} cursor="pointer">
                <Text
                    as="a"
                    href={postHref}
                    onClick={navigateToPost}
                    fontWeight="bold"
                    fontSize="lg"
                    textAlign="left"
                    mb={2}
                    noOfLines={compact ? 2 : 1}
                    _hover={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}
                >
                    {title || 'Untitled post'}
                </Text>
                {snippet && (
                    <Text
                        as="a"
                        href={postHref}
                        onClick={navigateToPost}
                        fontSize="sm"
                        color="text"
                        opacity={0.82}
                        noOfLines={compact ? 3 : 2}
                        mb={3}
                        _hover={{ opacity: 1 }}
                    >
                        {snippet}
                    </Text>
                )}
            {imageUrls.length > 0 && !compact && (
                <Box
                    mt={2}
                    w="100%"
                    h={CARD_IMAGE_HEIGHT}
                    maxH={CARD_IMAGE_HEIGHT}
                    overflow="hidden"
                    borderRadius="10px"
                    sx={{
                        '.swiper, .swiper-wrapper': { height: CARD_IMAGE_HEIGHT },
                        '.swiper-slide': { height: CARD_IMAGE_HEIGHT, display: 'flex' },
                    }}
                >
                    <PostCardCarousel
                        imageUrls={imageUrls}
                        visibleImages={visibleImages}
                        postHref={postHref}
                        title={title || ''}
                        onNavigate={navigateToPost}
                        onSlideChange={handleSlideChange}
                    />
                </Box>
            )}
        </Box>

            {/* Interaction Bar */}
            <Box mt={3} opacity={compact ? 0.92 : 1}>
                <InteractionBar post={post} showShare={false} />
            </Box>
        </Box>
    );
}
