import { Button, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Textarea, Spinner, useToast } from '@chakra-ui/react';
import { Avatar } from '@/components/shared/Avatar';
import { MoodBadgeIcon } from '@/components/shared/MoodBadgeIcon';
import { useMoodBadges } from '@/hooks/useMoodBadges';
import { Comment } from '@hiveio/dhive';
import { ExtendedComment } from '@/hooks/useComments';
import { FaRegComment, FaEdit, FaRetweet, FaBroadcastTower } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { MdTranslate } from "react-icons/md";
import { requestSnapCast, isRecentlyActive } from "@/lib/snapcast/intent";
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useState, useMemo, memo, useCallback, useEffect } from 'react';
import { getPostDate } from '@/lib/utils/GetPostDate';
import { separateContent, extractHivePostUrls, extractHangoutUrls, snapTextForMarkdown } from '@/lib/utils/snapUtils';
import { detectLang } from '@/lib/utils/detectLanguage';
import MediaRenderer from '@/components/shared/MediaRenderer';
import OffscreenGate from '@/components/shared/OffscreenGate';
import { IMAGE_ASPECT_RATIO } from '@/components/shared/ImageWithFallback';
import { hasMarkdownImage, isPlainFeedImageMedia, mediaHasEmbed } from '@/lib/images/feedLcp';

// Tight margin — media (iframes/videos/images) is the expensive part, so
// only cards genuinely close to the viewport keep it warm. See
// OffscreenGate's doc comment for how this differs from SnapList's
// whole-card gate.
const MEDIA_GATE_MARGIN = '3000px 0px 3000px 0px';

import HivePostPreview from '@/components/shared/HivePostPreview';
import HangoutPreviewCard from '@/components/hangouts/HangoutPreviewCard';
import { useCurrencyDisplay } from '@/hooks/useCurrencyDisplay';
import { useVoteCalculator } from '@/hooks/useVoteCalculator';
import { vote, commentWithKeychain } from '@/lib/hive/client-functions';
import { awardPoints } from '@/lib/points/client';
import NextLink from 'next/link';
import VoteControls from './VoteSlider';
import PileTray from '@/components/shared/PileTray';
import PatronBadge from '@/components/shared/PatronBadge';
import WaveBadge from '@/components/shared/WaveBadge';
import TrendingBadge from '@/components/shared/TrendingBadge';
import SnapieCommunityBadge from '@/components/shared/SnapieCommunityBadge';
import VaultBadge from '@/components/shared/VaultBadge';
import { isSnapieCommunityPost } from '@/lib/discovery/snapTrending';
import { usePatronStatus } from '@/hooks/usePatronStatus';
import { useCombflowPost } from '@/hooks/useCombflowPost';
import { translationCache } from '@/lib/utils/translationCache';

// Deeper replies than this render flush with their ancestor instead of
// indenting further — unbounded nesting crushes the card width on mobile.
const MAX_INDENT_LEVEL = 3;

interface SnapProps {
    comment: ExtendedComment;
    onOpen: () => void;
    setReply: (comment: Comment) => void;
    setConversation?: (conversation: Comment) => void;
    /** Reconciles this comment's optimistic vote data against the real
     *  settled chain value — see useSnaps.ts/useProfileSnaps.ts for why.
     *  Optional since not every data source has one yet. */
    refreshComment?: (author: string, permlink: string) => Promise<void> | void;
    level?: number; // Added level for indentation
    /** Home-feed photo that should be fetchpriority=high. */
    priorityUrl?: string | null;
    /** GIF, video, and oversized URLs in the home LCP scan. */
    deferUrls?: readonly string[];
    /** Keep a 4/3 media slot in the first paint so the image does not grow the card. */
    reserveMediaSpace?: boolean;
    /** First-viewport card. Its photos are in the server HTML, not behind a gate. */
    eagerMedia?: boolean;
    /** Preload this card's first photo. Only one card on the page sets this. */
    imagePriority?: boolean;
}

function sameUrlList(a?: readonly string[], b?: readonly string[]): boolean {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

const Snap = memo(({ comment, onOpen, setReply, setConversation, refreshComment, level = 0, priorityUrl = null, deferUrls, reserveMediaSpace = false, eagerMedia = false, imagePriority = false }: SnapProps) => {
    const commentDate = getPostDate(comment.created);
    const { username: user } = useCurrentUser();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editedBody, setEditedBody] = useState(comment.body);
    const [isEditing, setIsEditing] = useState(false);
    const [optimisticDeltaHBD, setOptimisticDeltaHBD] = useState(0);
    const [translatedText, setTranslatedText] = useState<string | null>(
        () => translationCache.get(comment.permlink) ?? null
    );
    const [isTranslating, setIsTranslating] = useState(false);
    const [nsfwRevealed, setNsfwRevealed] = useState(false);
    const { postData } = useCombflowPost(comment.author, comment.permlink, false);
    const { calculateDelta } = useVoteCalculator(user ?? null);
    const { getTier } = usePatronStatus();
    const { getEquippedBadge } = useMoodBadges();
    const payoutDisplay = useCurrencyDisplay(comment, optimisticDeltaHBD);
    const toast = useToast();
    
    // Check if user can edit (is author and post is less than 7 days old)
    const canEdit = useMemo(() => {
        if (!user || user !== comment.author) return false;
        const postAge = Date.now() - new Date(comment.created).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        return postAge < sevenDays;
    }, [user, comment.author, comment.created]);

    // Extract Hive post URLs for preview cards
    const hivePostUrls = useMemo(
        () => extractHivePostUrls(comment.body),
        [comment.body]
    );

    // Extract hangout room names for preview cards
    const hangoutRoomNames = useMemo(
        () => extractHangoutUrls(comment.body),
        [comment.body]
    );

    // Separate media from text using SkateHive's pattern
    const { text, media } = useMemo(
        () => separateContent(comment.body),
        [comment.body]
    );

    // Hive post URLs and hangout links render as cards, so they are not
    // also markdown. The home seed already carries the HTML (`bodyHtml`);
    // other pages load the renderer after paint.
    const textWithoutHiveUrls = useMemo(
        () => snapTextForMarkdown(comment.body || ''),
        [comment.body]
    );
    const seededHtml = comment.bodyHtml;
    const [lazyHtml, setLazyHtml] = useState('');
    useEffect(() => {
        if (typeof seededHtml === 'string') return;
        if (!textWithoutHiveUrls) return;
        let cancel = false;
        import('@/lib/utils/MarkdownRenderer').then((mod) => {
            if (cancel) return;
            setLazyHtml(mod.default(textWithoutHiveUrls, { defaultEmojiOwner: comment.author }));
        });
        return () => {
            cancel = true;
        };
    }, [seededHtml, textWithoutHiveUrls, comment.author]);
    const renderedText = typeof seededHtml === 'string' ? seededHtml : lazyHtml;

    const browserLang = typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'en';
    const detectedLang = useMemo(() => detectLang(text), [text]);
    // Show translate when: we detected a language and it differs from the browser's,
    // OR the text is too short/ambiguous to detect (detectedLang === null) — offer it anyway.
    // Hides the button when the snap is confidently the same language as the browser.
    const showTranslate = !!text && !translatedText && (detectedLang === null || detectedLang !== browserLang);
    const isNsfw = postData?.is_nsfw ?? false;

    const replies = comment.replies;

    function handleReplyModal() {
        setReply(comment);
        onOpen();
    }

    function handleConversation() {
        if (setConversation) setConversation(comment);
    }

    function handleSnapCast() {
        if (!setConversation) return;
        requestSnapCast(comment.author, comment.permlink);
        setConversation(comment);
    }

    async function handleVote(weight: number) {
        if (!user) {
            throw new Error('Please log in to vote');
        }
        
        const voteResult = await vote({
            username: user,
            author: comment.author,
            permlink: comment.permlink,
            weight: weight * 100
        });

        // Points, not just the on-chain vote — VoteControls only calls this on
        // a genuinely new vote (see VoteSlider.tsx's `wasVoted` guard), and the
        // server itself dedupes by (user, 'vote', author/permlink) besides, so
        // this is safe even if that ever changes.
        if (voteResult.success) {
            awardPoints('vote', user, comment.author, comment.permlink);

            // optimisticDeltaHBD is a guess made before the vote even broadcast
            // (see useVoteCalculator.ts) — reconcile it against the real settled
            // value once the chain has had a moment to catch up, same delay
            // convention as SnapList.tsx's handleNewComment. This also happens
            // to pick up any other concurrent votes on this comment, since
            // nothing else ever refreshes it once fetched (see useSnaps.ts).
            // Zero the optimistic delta once the real data lands so the two
            // don't stack — the fresh comment already includes this vote.
            setTimeout(async () => {
                await refreshComment?.(comment.author, comment.permlink);
                setOptimisticDeltaHBD(0);
            }, 3000);
        }

        return voteResult;
    }

    function handleShareOnX() {
        const snapUrl = `${window.location.origin}/@${comment.author}/${comment.permlink}`;
        const tweet = `${snapUrl}\n\nCrossposted from snapie.io`;
        window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}`, '_blank', 'noopener,noreferrer');
    }

    async function handleTranslate() {
        if (isTranslating || !text) return;
        setIsTranslating(true);
        try {
            const targetLang = navigator.language.split('-')[0];
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, targetLang }),
            });
            const data = await res.json();
            if (data.translatedText) {
                translationCache.set(comment.permlink, data.translatedText);
                setTranslatedText(data.translatedText);
            } else {
                toast({ title: 'Translation failed', description: data.error ?? 'Could not translate.', status: 'error', duration: 3000 });
            }
        } catch {
            toast({ title: 'Translation failed', description: 'Could not reach the translation service.', status: 'error', duration: 3000 });
        } finally {
            setIsTranslating(false);
        }
    }

    function handleReSnap() {
        const snapUrl = `${window.location.origin}/@${comment.author}/${comment.permlink}`;
        navigator.clipboard.writeText(snapUrl);
        document.dispatchEvent(new CustomEvent('resnap', { detail: { url: snapUrl } }));
        document.getElementById('snap-composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast({
            title: 'Re-Snap',
            description: 'Link added to your composer — add a comment and hit Post!',
            status: 'success',
            duration: 3000,
        });
    }

    async function handleEditPost() {
        if (!user || !editedBody.trim()) return;
        
        setIsEditing(true);
        try {
            // Parse existing metadata
            const metadata = comment.json_metadata ? JSON.parse(comment.json_metadata) : {};
            
            // Edit is same as comment but with same permlink
            const response = await commentWithKeychain({
                data: {
                    username: user,
                    parent_username: comment.parent_author,
                    parent_perm: comment.parent_permlink,
                    permlink: comment.permlink,
                    title: comment.title || '',
                    body: editedBody,
                    json_metadata: JSON.stringify(metadata),
                    comment_options: ''
                }
            });
            
            if (response && response.success) {
                toast({
                    title: 'Post Updated',
                    description: 'Your post has been updated successfully!',
                    status: 'success',
                    duration: 3000,
                });
                setIsEditModalOpen(false);
                // Update comment body locally
                comment.body = editedBody;
            } else {
                const errorMsg = (response as any)?.error || 'Edit failed';
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            console.error('Error editing post:', error);
            const errorMessage = error?.message || error?.error || 'Unknown error';
            toast({
                title: 'Edit Failed',
                description: `Failed to update post: ${errorMessage}`,
                status: 'error',
                duration: 5000,
            });
        } finally {
            setIsEditing(false);
        }
    }
    const indented = level > 0 && level <= MAX_INDENT_LEVEL;
    return (
        <div className={indented ? 'snap-indent' : undefined}>
            <article className="snap-card">
                <div className="snap-row">
                    <Avatar
                        username={comment.author}
                        size="42px"
                        flexShrink={0}
                        sx={{ marginTop: '-2px' }}
                        overlay={
                            getEquippedBadge(comment.author)
                                ? <MoodBadgeIcon sku={getEquippedBadge(comment.author)!} username={comment.author} size="24px" />
                                : undefined
                        }
                    />

                    <div className="snap-main">
                        <div className="snap-head">
                            <ul className="snap-meta">
                                <li>
                                    <div className="snap-byline">
                                        <NextLink
                                            href={`/@${comment.author}`}
                                            prefetch={false}
                                            className="snap-author"
                                        >
                                            @{comment.author}
                                        </NextLink>
                                        <span className="snap-dot">·</span>
                                        <span className="snap-date" suppressHydrationWarning>{commentDate}</span>
                                    </div>
                                </li>
                                {getTier(comment.author) && <li><PatronBadge tier={getTier(comment.author)} /></li>}
                                {comment.source === 'wave' && <li><WaveBadge /></li>}
                                {comment.isDiscovery && comment.discoveryReason === 'trending' && <li><TrendingBadge /></li>}
                                {comment.isDiscovery && comment.discoveryReason === 'resurrected' && <li><VaultBadge /></li>}
                                {isSnapieCommunityPost(comment) && <li><SnapieCommunityBadge /></li>}
                            </ul>
                            {canEdit && (
                                <button
                                    type="button"
                                    className="snap-edit"
                                    onClick={() => setIsEditModalOpen(true)}
                                    aria-label="Edit post"
                                >
                                    <FaEdit size={12} />
                                </button>
                            )}
                        </div>

                        {isNsfw && !nsfwRevealed ? (
                            <div className="snap-nsfw">
                                <span style={{ fontSize: '18px' }}>⚠️</span>
                                <span className="snap-nsfw-title">Sensitive content</span>
                                <button type="button" className="snap-text-btn" onClick={() => setNsfwRevealed(true)}>
                                    Show anyway
                                </button>
                            </div>
                        ) : (
                            <>
                        {media && (
                            eagerMedia && hasMarkdownImage(media) ? (
                                <>
                                    <MediaRenderer
                                        key={`media-${comment.permlink}`}
                                        mediaContent={media}
                                        priority={imagePriority}
                                        painted
                                        onlyImages
                                        priorityUrl={priorityUrl}
                                        deferUrls={deferUrls}
                                    />
                                    {mediaHasEmbed(media) && (
                                        <OffscreenGate rootMargin={MEDIA_GATE_MARGIN}>
                                            <MediaRenderer mediaContent={media} skipImages />
                                        </OffscreenGate>
                                    )}
                                </>
                            ) : (
                            <OffscreenGate
                                rootMargin={MEDIA_GATE_MARGIN}
                                unmountedAspectRatio={
                                    reserveMediaSpace && (isPlainFeedImageMedia(media) || hasMarkdownImage(media)) ? IMAGE_ASPECT_RATIO : undefined
                                }
                            >
                                <MediaRenderer
                                    key={`media-${comment.permlink}`}
                                    mediaContent={media}
                                    priorityUrl={priorityUrl}
                                    deferUrls={deferUrls}
                                />
                            </OffscreenGate>
                            )
                        )}

                        {translatedText ? (
                            <div>
                                <div className="snap-translated">{translatedText}</div>
                                <button
                                    type="button"
                                    className="snap-text-btn snap-show-original"
                                    onClick={() => { translationCache.delete(comment.permlink); setTranslatedText(null); }}
                                >
                                    Show original
                                </button>
                            </div>
                        ) : (
                            <>
                                {renderedText && (
                                    <div
                                        className={setConversation ? 'snap-body is-clickable' : 'snap-body'}
                                        dangerouslySetInnerHTML={{ __html: renderedText }}
                                        onClick={setConversation ? handleConversation : undefined}
                                    />
                                )}
                                {showTranslate && (
                                    <button type="button" className="snap-translate" onClick={handleTranslate}>
                                        {isTranslating ? <Spinner size="xs" /> : <MdTranslate size={12} />}
                                        <span>{isTranslating ? 'Translating...' : 'Translate'}</span>
                                    </button>
                                )}
                            </>
                        )}

                        {hivePostUrls.length > 0 && (
                            <div className="snap-stack">
                                {hivePostUrls.map(({ author, permlink }, index) => (
                                    <HivePostPreview
                                        key={`${author}-${permlink}-${index}`}
                                        author={author}
                                        permlink={permlink}
                                    />
                                ))}
                            </div>
                        )}

                        {hangoutRoomNames.length > 0 && (
                            <div className="snap-stack">
                                {hangoutRoomNames.map((roomName, index) => (
                                    <HangoutPreviewCard key={`${roomName}-${index}`} roomName={roomName} />
                                ))}
                            </div>
                        )}
                            </>
                        )}

                        <div className="snap-actions">
                            <VoteControls
                                initialVoted={comment.active_votes?.some(item => item.voter === user) ?? false}
                                initialVoteCount={comment.active_votes?.length ?? comment.voteCount ?? 0}
                                onVote={handleVote}
                                onVoteOptimistic={async (weight) => setOptimisticDeltaHBD(await calculateDelta(weight))}
                                onVoteRollback={() => setOptimisticDeltaHBD(0)}
                                author={comment.author}
                                permlink={comment.permlink}
                            />
                            <div className="snap-action-group">
                                <button type="button" className="snap-action" onClick={handleReplyModal} aria-label="Reply">
                                    <FaRegComment />
                                </button>
                                {setConversation && (
                                    <button
                                        type="button"
                                        className="snap-action snap-children"
                                        onClick={handleConversation}
                                        aria-label="Open conversation"
                                    >
                                        {comment.children}
                                    </button>
                                )}
                                {setConversation && (
                                    <button
                                        type="button"
                                        className={`snap-action snap-cast${isRecentlyActive(comment) ? ' snap-cast-active' : ''}`}
                                        onClick={handleSnapCast}
                                        aria-label="Open as Snap-Cast (live)"
                                        title="Snap-Cast: follow replies live"
                                    >
                                        <FaBroadcastTower />
                                    </button>
                                )}
                                <button type="button" className="snap-action" onClick={handleReSnap}>
                                    <FaRetweet />
                                    <span className="snap-resnap-label">Re-Snap/Share</span>
                                </button>
                                <button type="button" className="snap-action snap-x" onClick={handleShareOnX} aria-label="Share on X">
                                    <FaXTwitter />
                                </button>
                            </div>
                            <span className="snap-payout">
                                {payoutDisplay}
                            </span>
                        </div>
                        <PileTray author={comment.author} permlink={comment.permlink} targetType="snap" />
                    </div>
                </div>
            </article>

            {isEditModalOpen && (
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="xl">
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Edit Post</ModalHeader>
                    <ModalBody>
                        <Textarea
                            value={editedBody}
                            onChange={(e) => setEditedBody(e.target.value)}
                            placeholder="Edit your post..."
                            rows={10}
                            bg="background"
                            border="tb1"
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={() => setIsEditModalOpen(false)} isDisabled={isEditing}>
                            Cancel
                        </Button>
                        <Button
                            colorScheme="blue"
                            onClick={handleEditPost}
                            isLoading={isEditing}
                            loadingText="Updating..."
                        >
                            Update
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            )}

            {replies && replies.length > 0 && (
                <div className="snap-stack">
                    {replies.map((reply: Comment) => (
                        <Snap
                            key={reply.permlink}
                            comment={reply}
                            onOpen={onOpen}
                            setReply={setReply}
                            setConversation={setConversation}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Only re-render if the comment permlink or active_votes length changes
    return (
        prevProps.comment.permlink === nextProps.comment.permlink &&
        (prevProps.comment.active_votes?.length ?? prevProps.comment.voteCount) ===
            (nextProps.comment.active_votes?.length ?? nextProps.comment.voteCount) &&
        prevProps.level === nextProps.level &&
        prevProps.priorityUrl === nextProps.priorityUrl &&
        sameUrlList(prevProps.deferUrls, nextProps.deferUrls) &&
        prevProps.reserveMediaSpace === nextProps.reserveMediaSpace &&
        prevProps.eagerMedia === nextProps.eagerMedia &&
        prevProps.imagePriority === nextProps.imagePriority
    );
});

Snap.displayName = 'Snap';

export default Snap;
