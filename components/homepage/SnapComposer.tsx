import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Box, HStack, Image, IconButton, Wrap, Spinner, Progress, Text, VStack } from '@chakra-ui/react';
import MentionHighlightedTextarea from '@/components/shared/MentionHighlightedTextarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import GiphySelector from './GiphySelector';
import ImageUploader from './ImageUploader';
import AudioRecorder from './AudioRecorder';
import { IGif } from '@giphy/js-types';
import { CloseIcon } from '@chakra-ui/icons';
import { FaImage, FaVideo, FaMicrophone, FaSmile } from 'react-icons/fa';
import { MdGif } from 'react-icons/md';
import { ALL_COMMON_EMOJIS, insertEmoji, getSelectionFromTextarea } from '@snapie/composer';
import { Comment } from '@hiveio/dhive';
import { getLastSnapsContainer, uploadImageWithKeychain, signAndBroadcastWithKeychain } from '@/lib/hive/client-functions';
import { useUserSettings } from '@/hooks/useUserSettings';
import { aggregateBeneficiaries, type Beneficiary } from '@/lib/utils/aggregateBeneficiaries';
import { snapOpenAttributeKey } from '@/lib/utils/openAttribute';
import MemePickerModal from './MemePickerModal';
import ProxiedImage from '@/components/shared/ProxiedImage';

// SDK imports
import { snapieComposer, snapieVideoComposer } from '@/lib/utils/composerSdk';
import { awardPoints } from '@/lib/points/client';
import { 
    uploadVideoTo3Speak,
    extractVideoThumbnail,
    uploadToIPFS,
    set3SpeakThumbnail,
    extractVideoIdFromEmbedUrl,
    bufferFileInMemory
} from '@snapie/operations/video';
import { pickVideoFile } from '@/lib/utils/pickVideoFile';

// Type for tracking image upload state
interface UploadingImage {
    file: File;
    previewUrl: string;
    uploadedUrl: string | null;
    progress: number;
    error?: string;
}

interface SnapComposerProps {
    pa: string;
    pp: string;
    onNewComment: (newComment: Partial<Comment>) => void;
    post?: boolean;
    onClose: () => void;
}

const SnapComposer = forwardRef<HTMLTextAreaElement, SnapComposerProps>(function SnapComposer({ pa, pp, onNewComment, post = false, onClose }, forwardedRef) {
    const { username: user } = useCurrentUser();

    const postBodyRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwardedRef, () => postBodyRef.current as HTMLTextAreaElement);
    const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([]);
    const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
    const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
    // Distinct from the byte-transfer percentage above — 'processing' covers
    // the window after TUS finishes sending bytes but before 3Speak confirms
    // the video actually transcoded into something playable (see
    // waitForVideoReady in @snapie/operations/video). Without a separate
    // status the UI would sit at "100% uploaded" for that whole wait with no
    // explanation.
    const [videoUploadStatus, setVideoUploadStatus] = useState<'uploading' | 'processing' | 'complete' | 'error' | null>(null);
    const [videoEmbedUrl, setVideoEmbedUrl] = useState<string | null>(null);
    const [thumbnailProcessing, setThumbnailProcessing] = useState<boolean>(false);
    const [audioEmbedUrl, setAudioEmbedUrl] = useState<string | null>(null);
    const [isAudioRecorderOpen, setAudioRecorderOpen] = useState(false);
    const [isGiphyModalOpen, setGiphyModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { percentHbd } = useUserSettings();
    const [isMemePickerOpen, setIsMemePickerOpen] = useState(false);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const emojiRef = useRef<HTMLDivElement>(null);
    const emojiToggleRef = useRef<HTMLButtonElement>(null);
    const [memeBeneficiaries, setMemeBeneficiaries] = useState<Beneficiary[]>([]);
    const [memeTemplateIds, setMemeTemplateIds] = useState<string[]>([]);
    const [isMemeUploading, setIsMemeUploading] = useState(false);

    // Listen for re-snap events from Snap cards and pre-fill the textarea
    useEffect(() => {
        function onReSnap(e: Event) {
            const { url } = (e as CustomEvent<{ url: string }>).detail;
            if (!postBodyRef.current) return;
            postBodyRef.current.value = url;
            // A direct .value write doesn't fire a native input event — the
            // mention-highlight overlay mirrors its own text off that event,
            // so without this its backdrop silently keeps showing the old,
            // pre-resnap content underneath the now-changed real textarea.
            postBodyRef.current.dispatchEvent(new Event('input', { bubbles: true }));
            postBodyRef.current.focus();
        }
        document.addEventListener('resnap', onReSnap);
        return () => document.removeEventListener('resnap', onReSnap);
    }, []);

    // DecentMemes — handle memeCreated postMessage
    const handleMemeCreatedRef = useRef<(payload: any) => Promise<void>>(async () => {});
    handleMemeCreatedRef.current = async (payload: any) => {
        if (!user) return;
        setIsMemeUploading(true);
        setIsMemePickerOpen(false);
        try {
            const blob: Blob = await (await fetch(payload.imageDataUrl)).blob();
            const file = new File([blob], payload.imageFileName ?? 'meme.png', { type: payload.imageMimeType ?? 'image/png' });
            const hostedUrl = await uploadImageWithKeychain(file, user);

            // Insert image into textarea
            if (postBodyRef.current) {
                const cur = postBodyRef.current.value;
                postBodyRef.current.value = cur ? `${cur}\n\n![meme](${hostedUrl})` : `![meme](${hostedUrl})`;
                // See the resnap handler above — direct .value writes need a
                // manual input event for the highlight overlay to notice.
                postBodyRef.current.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Aggregate beneficiaries (comment slot, since snaps are comments)
            const incoming: Beneficiary[] = (payload.beneficiaries?.comment ?? []).map(
                (b: any) => ({ account: b.account, weight: b.weight }),
            );
            setMemeBeneficiaries(prev => aggregateBeneficiaries(prev, incoming, true));
            setMemeTemplateIds(prev => [...prev, payload.template?.id].filter(Boolean));
        } catch {
            // Upload failure is silent — user still has the modal to retry
        } finally {
            setIsMemeUploading(false);
        }
    };

    useEffect(() => {
        function onMessage(e: MessageEvent) {
            if (e.origin !== 'https://decentmemes.com') return;
            if (e.data?.type !== 'memeCreated') return;
            handleMemeCreatedRef.current(e.data);
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    useEffect(() => {
        if (!emojiOpen) return;
        const onDoc = (event: MouseEvent) => {
            if (!emojiRef.current?.contains(event.target as Node)) setEmojiOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setEmojiOpen(false);
                emojiToggleRef.current?.focus();
            }
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [emojiOpen]);

    const handleEmojiClick = (emoji: string) => {
        const el = postBodyRef.current;
        if (!el) return;
        const result = insertEmoji(el.value, getSelectionFromTextarea(el), emoji);
        el.value = result.text;
        // See the resnap handler above — direct .value writes need a manual
        // input event for the highlight overlay to notice.
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.focus();
        requestAnimationFrame(() => el.setSelectionRange(result.cursorPosition, result.cursorPosition));
    };

    const buttonText = post ? "Reply" : "Post";
    const hasVideo = selectedVideo !== null;
    const hasAudio = audioEmbedUrl !== null;
    const hasVideoInProgress = hasVideo || videoUploadProgress > 0;
    const hasMeme = memeTemplateIds.length > 0 || isMemeUploading;

    // Check if any images are still uploading
    const imagesStillUploading = uploadingImages.some(img => img.uploadedUrl === null && !img.error);
    const isDisabled = !user || isLoading || imagesStillUploading || isMemeUploading;

    // Opens the video picker directly from this button's own onClick — unlike
    // ImageUploader/GiphySelector, this can't be a separate component with its
    // own nested clickable element. showOpenFilePicker() (used by
    // pickVideoFile — see its own doc for why) only works when called as a
    // direct response to a user gesture, and a click routed through a
    // wrapping <label> to a nested child's onClick handler doesn't reliably
    // count as one in every browser — confirmed live: this button did
    // nothing on Android once VideoUploader stopped rendering a real
    // wrapped <input> (the case a <label> click normally forwards to) and
    // started calling pickVideoFile() instead.
    async function handleVideoButtonClick() {
        const file = await pickVideoFile();
        if (!file) return;

        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            alert('Video file is too large. Maximum size is 100MB.');
            return;
        }
        const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (!validTypes.includes(file.type)) {
            alert('Invalid video format. Please use MP4, WebM, or MOV.');
            return;
        }

        handleVideoSelection(file);
    }

    // Handle video selection and start upload immediately using SDK
    async function handleVideoSelection(file: File) {
        if (!user) {
            // Snapie Auth restores its session over the network (unlike Aioha,
            // which reads synchronously from localStorage) — on a slow mobile
            // connection there's a real window where the composer looks logged
            // in but `user` hasn't hydrated yet. Without this guard, the
            // upload would still fire with owner: '', which 3Speak silently
            // accepts and produces an orphaned video: the UI shows the upload
            // as "done" (embedUrl set) but the embed never actually plays
            // since nothing valid is behind it — no error, just a permanent
            // stall. Failing fast here with a clear message beats that; same
            // wording as handleImageSelection's guard below since there's no
            // way to tell "still hydrating" apart from "genuinely logged out."
            alert('You must be logged in to upload videos.');
            return;
        }
        setSelectedVideo(file);
        setVideoUploadProgress(1);
        setVideoUploadStatus('uploading');
        setThumbnailProcessing(true);
        
        const apiKey = process.env.NEXT_PUBLIC_3SPEAK_API_KEY || '';
        if (!apiKey) {
            alert('3Speak API key not configured');
            setSelectedVideo(null);
            setVideoUploadProgress(0);
            setVideoUploadStatus(null);
            setThumbnailProcessing(false);
            return;
        }

        console.log('🎬 Starting video upload for:', file.name);
        
        try {
            // Buffer once before anything reads it — the upload and the
            // thumbnail extraction below run in parallel against the same
            // file, and on Android a second read of the original
            // `content://`-backed File throws NotReadableError (see
            // bufferFileInMemory). This was the actual cause of video uploads
            // silently dying at offset 0 on mobile.
            const source = await bufferFileInMemory(file);

            // Upload video and extract thumbnail in parallel using SDK
            const [videoResult, thumbnailBlob] = await Promise.allSettled([
                uploadVideoTo3Speak(source, {
                    apiKey,
                    owner: user || '',
                    appName: 'snapie',
                    onProgress: (progress, status) => {
                        setVideoUploadProgress(progress);
                        setVideoUploadStatus(status);
                    }
                }),
                extractVideoThumbnail(source).catch(() => null)
            ]);

            if (videoResult.status === 'fulfilled') {
                setVideoEmbedUrl(videoResult.value.embedUrl);
                console.log('✅ Video uploaded:', videoResult.value.embedUrl);
                
                // Try to upload and set thumbnail
                if (thumbnailBlob.status === 'fulfilled' && thumbnailBlob.value && user) {
                    try {
                        // Try Hive first (with user's signature via Aioha), fallback to IPFS
                        let thumbnailUrl: string;
                        try {
                            const thumbnailFile = new File([thumbnailBlob.value], `${file.name}_thumb.jpg`, { type: 'image/jpeg' });
                            thumbnailUrl = await uploadImageWithKeychain(thumbnailFile, user);
                        } catch {
                            thumbnailUrl = await uploadToIPFS(thumbnailBlob.value);
                        }
                        
                        // Set thumbnail via 3Speak API
                        if (videoResult.value.videoId) {
                            await set3SpeakThumbnail(videoResult.value.videoId, thumbnailUrl, apiKey);
                            console.log('✅ Thumbnail set:', thumbnailUrl);
                        }
                    } catch (error) {
                        console.warn('⚠️ Thumbnail failed (video still works):', error);
                    }
                }
            } else {
                throw videoResult.reason;
            }
        } catch (error) {
            console.error('❌ Video upload failed:', error);
            const message = error instanceof Error && error.message
                ? error.message
                : 'Failed to upload video. Please try again.';
            alert(message);
            setSelectedVideo(null);
            setVideoUploadProgress(0);
            setVideoUploadStatus(null);
        } finally {
            setThumbnailProcessing(false);
        }
    }

    // Handle image selection - upload immediately
    async function handleImageSelection(files: File[]) {
        if (!user) {
            alert('You must be logged in to upload images.');
            return;
        }

        // Create initial state for each file
        const newImages: UploadingImage[] = files.map(file => ({
            file,
            previewUrl: URL.createObjectURL(file),
            uploadedUrl: null,
            progress: 0,
        }));

        // Add to state immediately (show previews)
        setUploadingImages(prev => [...prev, ...newImages]);

        // Start uploads for each file
        const startIndex = uploadingImages.length;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const imageIndex = startIndex + i;
            
            try {
                console.log(`📷 Starting upload for image ${i + 1}:`, file.name);
                
                const url = await uploadImageWithKeychain(file, user, {
                    onProgress: (progress) => {
                        setUploadingImages(prev => prev.map((img, idx) => 
                            idx === imageIndex ? { ...img, progress } : img
                        ));
                    }
                });
                
                console.log(`✅ Image ${i + 1} uploaded:`, url);
                
                // Update with uploaded URL
                setUploadingImages(prev => prev.map((img, idx) => 
                    idx === imageIndex ? { ...img, uploadedUrl: url, progress: 100 } : img
                ));
            } catch (error) {
                console.error(`❌ Error uploading image ${i + 1}:`, error);
                
                // Mark as failed
                setUploadingImages(prev => prev.map((img, idx) => 
                    idx === imageIndex ? { ...img, error: error instanceof Error ? error.message : 'Upload failed', progress: 0 } : img
                ));
            }
        }
    }

    // Remove an image (cleanup preview URL)
    function removeImage(index: number) {
        setUploadingImages(prev => {
            const img = prev[index];
            if (img?.previewUrl) {
                URL.revokeObjectURL(img.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
    }

    async function handleComment() {
        if (!user) {
            alert('You must be logged in to post.');
            return;
        }
        
        let bodyText = postBodyRef.current?.value || '';

        if (!bodyText.trim() && uploadingImages.length === 0 && !selectedGif && !selectedVideo && !audioEmbedUrl) {
            alert('Please enter some text, upload an image, select a gif, upload a video, or record audio before posting.');
            return;
        }

        setIsLoading(true);

        try {
            // Images are already uploaded - just collect the URLs
            const imageUrls = uploadingImages
                .filter(img => img.uploadedUrl !== null)
                .map(img => img.uploadedUrl as string);

            // Resolve parent permlink for snaps
            let parentPermlink = pp;
            const isNewSnap = pp === "snaps";
            if (isNewSnap) {
                parentPermlink = (await getLastSnapsContainer()).permlink;
            }

            // Meme and video are mutually exclusive — use video composer (10% snapie
            // beneficiary) only when no meme is present; meme posts use the base
            // composer with DecentMemes beneficiaries merged in instead.
            const composer = videoEmbedUrl ? snapieVideoComposer : snapieComposer;

            // This composer is shared by every comment-composing surface
            // (snap replies, blog post comments, Shorts comments) — isNewSnap
            // is the same signal already used a few lines down to decide
            // snap vs. comment for points awarding.
            const openAttributeKey = snapOpenAttributeKey(isNewSnap);

            // Build operations using SDK
            const result = composer.build({
                author: user,
                body: bodyText,
                parentAuthor: pa,
                parentPermlink,
                images: imageUrls,
                gifUrl: selectedGif?.images.downsized_medium.url,
                videoEmbedUrl: videoEmbedUrl || undefined,
                audioEmbedUrl: audioEmbedUrl || undefined,
                percentHbd,
                ...(memeBeneficiaries.length > 0 && { beneficiaries: memeBeneficiaries }),
                metadata: {
                    [openAttributeKey]: {},
                    ...(memeTemplateIds.length > 0 && {
                        decentmemes: { v: 2, templateIds: memeTemplateIds, frontend: 'snapie' },
                    }),
                },
            });

            // Broadcast with Keychain
            const commentResponse = await signAndBroadcastWithKeychain(
                user,
                result.operations,
                'posting'
            );
            
            if (commentResponse.success) {
                // Snapie Points: a top-level snap (parent is the snaps container)
                // earns 'snap'; anything else here is a reply, i.e. a 'comment'.
                awardPoints(pp === 'snaps' ? 'snap' : 'comment', user, user, result.permlink);

                // Cleanup preview URLs
                uploadingImages.forEach(img => {
                    if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
                });
                
                // Reset form
                postBodyRef.current!.value = '';
                // See the resnap handler above — direct .value writes need a
                // manual input event for the highlight overlay to notice.
                postBodyRef.current!.dispatchEvent(new Event('input', { bubbles: true }));
                setUploadingImages([]);
                setSelectedGif(null);
                setSelectedVideo(null);
                setVideoEmbedUrl(null);
                setVideoUploadProgress(0);
                setVideoUploadStatus(null);
                setThumbnailProcessing(false);
                setAudioEmbedUrl(null);
                setMemeBeneficiaries([]);
                setMemeTemplateIds([]);

                const newComment: Partial<Comment> = {
                    author: user,
                    permlink: result.permlink,
                    body: result.body,
                    created: new Date().toISOString() as any,
                };

                onNewComment(newComment); 
                onClose();
            } else {
                alert('Failed to post. Please try again.');
            }
        } catch (error) {
            alert('Error posting: ' + error);
        } finally {
            setIsLoading(false);
        }
    }

    // Detect Ctrl+Enter and submit
    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.ctrlKey && event.key === 'Enter') {
            handleComment();
        }
    }

    function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
        const files = Array.from(event.clipboardData?.items ?? [])
            .filter(item => item.type.startsWith('image/'))
            .map(item => item.getAsFile())
            .filter((f): f is File => f !== null);
        if (files.length === 0) return;
        event.preventDefault();
        handleImageSelection(files);
    }

    return (
        <div className="feed-composer">
            <MentionHighlightedTextarea
                placeholder={!user ? "Please log in to post..." : "What's happening?"}
                bg="muted"
                border="1px solid"
                borderColor="surfaceBorder"
                borderRadius="10px"
                wrapperProps={{ mb: 3, minH: '92px' }}
                ref={postBodyRef}
                _placeholder={{ color: 'overlay.600' }}
                _focus={{ borderColor: 'primary', boxShadow: '0 0 0 1px rgba(28, 161, 241, 0.42), 0 0 34px rgba(28, 161, 241, 0.16)' }}
                isDisabled={!user || isLoading}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
            />
            <div className="feed-toolbar">
                <div className="feed-tools" ref={emojiRef}>
                    <label
                        className={!user || isLoading ? 'feed-tool-btn is-disabled' : 'feed-tool-btn'}
                        aria-label="Image"
                    >
                        <FaImage size={20} />
                        <ImageUploader onUpload={handleImageSelection} />
                    </label>
                    <button
                        type="button"
                        className="feed-tool-btn"
                        onClick={() => setGiphyModalOpen(!isGiphyModalOpen)}
                        disabled={!user || isLoading}
                        aria-label="GIF"
                    >
                        <MdGif size={44} />
                    </button>
                    <button
                        ref={emojiToggleRef}
                        type="button"
                        className="feed-tool-btn"
                        aria-label="Emoji"
                        aria-expanded={emojiOpen}
                        disabled={!user || isLoading}
                        onClick={() => setEmojiOpen(open => !open)}
                    >
                        <FaSmile size={20} />
                    </button>
                    {emojiOpen && (
                        <div className="feed-emoji-pop">
                            {ALL_COMMON_EMOJIS.map((emoji, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => { handleEmojiClick(emoji); setEmojiOpen(false); emojiToggleRef.current?.focus(); }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                    <button
                        type="button"
                        className="feed-tool-btn"
                        onClick={handleVideoButtonClick}
                        disabled={!user || isLoading || hasVideoInProgress || hasAudio || hasMeme}
                        title={hasMeme ? 'Remove meme to add a video' : undefined}
                        aria-label="Video"
                    >
                        <FaVideo size={20} />
                    </button>
                    <button
                        type="button"
                        className="feed-tool-btn"
                        onClick={() => setAudioRecorderOpen(true)}
                        disabled={!user || isLoading || hasVideoInProgress || hasAudio}
                        aria-label="Audio"
                    >
                        <FaMicrophone size={20} />
                    </button>
                    <button
                        type="button"
                        className={hasMeme ? 'feed-tool-btn is-active' : 'feed-tool-btn'}
                        onClick={() => setIsMemePickerOpen(true)}
                        disabled={!user || isLoading || hasVideoInProgress || isMemeUploading}
                        title={hasVideoInProgress ? 'Remove video to add a meme' : 'Add a meme'}
                    >
                        {isMemeUploading ? <Spinner size="xs" /> : <span className="feed-meme-mark">MEME</span>}
                    </button>
                </div>
                <button
                    type="button"
                    className="feed-post-btn"
                    onClick={handleComment}
                    disabled={isDisabled || Boolean(selectedVideo && !videoEmbedUrl)}
                >
                    {isLoading ? <Spinner size="sm" /> : imagesStillUploading ? "Uploading..." : (!user ? "Log in to post" : buttonText)}
                </button>
            </div>
            {(uploadingImages.length > 0 || selectedGif || selectedVideo || audioEmbedUrl || memeTemplateIds.length > 0) && (
            <Wrap spacing={4}>
                {uploadingImages.map((image, index) => (
                    <Box key={index} position="relative" minW="100px">
                        <Image alt="" src={image.previewUrl} boxSize="100px" borderRadius="base" objectFit="cover" />
                        <IconButton
                            aria-label="Remove image"
                            icon={<CloseIcon />}
                            size="xs"
                            position="absolute"
                            top="0"
                            right="0"
                            onClick={() => removeImage(index)}
                            isDisabled={isLoading}
                        />
                        {image.error ? (
                            <Text fontSize="xs" color="red.400" mt={1}>❌ {image.error}</Text>
                        ) : image.uploadedUrl ? (
                            <Text fontSize="xs" color="green.400" mt={1}>✓ Ready</Text>
                        ) : (
                            <Progress value={image.progress} size="xs" colorScheme="blue" mt={2} />
                        )}
                    </Box>
                ))}
                {selectedGif && (
                    <Box key={selectedGif.id} position="relative" boxSize="100px" borderRadius="base" overflow="hidden">
                        <ProxiedImage url={selectedGif.images.downsized_medium.url} alt="" sizes="100px" />
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
                {selectedVideo && (
                    <Box position="relative" bg="muted" p={3} borderRadius="base" border="1px solid" borderColor="gray.600" w="100%">
                        <VStack align="start" spacing={2}>
                            <HStack justify="space-between" w="100%">
                                <Text fontSize="sm" fontWeight="bold" color="text">📹 {selectedVideo.name}</Text>
                                <IconButton
                                    aria-label="Remove video"
                                    icon={<CloseIcon />}
                                    size="xs"
                                    onClick={() => {
                                        setSelectedVideo(null);
                                        setVideoEmbedUrl(null);
                                        setVideoUploadProgress(0);
                                        setVideoUploadStatus(null);
                                    }}
                                    isDisabled={isLoading}
                                />
                            </HStack>
                            <Text fontSize="xs" color="overlay.500">
                                {(selectedVideo.size / (1024 * 1024)).toFixed(2)} MB
                            </Text>
                            {videoUploadProgress > 0 && (
                                <Box w="100%">
                                    <Progress
                                        value={videoUploadProgress}
                                        size="sm"
                                        colorScheme="blue"
                                        isIndeterminate={videoUploadStatus === 'processing'}
                                    />
                                    <Text fontSize="xs" mt={1} color="text">
                                        {videoUploadStatus === 'processing'
                                            ? 'Processing video… this can take a minute'
                                            : `${videoUploadProgress}% uploaded`}
                                    </Text>
                                    {thumbnailProcessing && (
                                        <Text fontSize="xs" color="blue.400">Generating thumbnail...</Text>
                                    )}
                                </Box>
                            )}
                        </VStack>
                    </Box>
                )}
                {audioEmbedUrl && (
                    <Box position="relative" bg="muted" p={3} borderRadius="base" border="1px solid" borderColor="gray.600" w="100%">
                        <VStack align="start" spacing={2}>
                            <HStack justify="space-between" w="100%">
                                <Text fontSize="sm" fontWeight="bold" color="text">🎤 Audio Snap</Text>
                                <IconButton
                                    aria-label="Remove audio"
                                    icon={<CloseIcon />}
                                    size="xs"
                                    onClick={() => setAudioEmbedUrl(null)}
                                    isDisabled={isLoading}
                                />
                            </HStack>
                            <Text fontSize="xs" color="green.400">✓ Ready to post</Text>
                        </VStack>
                    </Box>
                )}
                {memeTemplateIds.length > 0 && (
                    <Box position="relative" bg="muted" p={3} borderRadius="base" border="1px solid" borderColor="border" w="100%">
                        <HStack justify="space-between">
                            <Text fontSize="sm" fontWeight="bold" color="blue.300">
                                🐸 {memeTemplateIds.length} meme{memeTemplateIds.length > 1 ? 's' : ''} added
                            </Text>
                            <IconButton
                                aria-label="Remove memes"
                                icon={<CloseIcon />}
                                size="xs"
                                onClick={() => { setMemeTemplateIds([]); setMemeBeneficiaries([]); }}
                                isDisabled={isLoading}
                            />
                        </HStack>
                    </Box>
                )}
            </Wrap>
            )}
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
            {user && isAudioRecorderOpen && (
                <AudioRecorder
                    isOpen
                    onClose={() => setAudioRecorderOpen(false)}
                    onAudioRecorded={(playUrl) => setAudioEmbedUrl(playUrl)}
                    username={user}
                />
            )}
            {isMemePickerOpen && (
                <MemePickerModal
                    isOpen
                    onClose={() => setIsMemePickerOpen(false)}
                />
            )}
        </div>
    );
});

SnapComposer.displayName = 'SnapComposer';

export default SnapComposer;
