'use client'
import HiveClient from "@/lib/hive/hiveclient"
import { useCallback, useEffect, useRef, useState } from "react"
import { Comment } from "@hiveio/dhive"
import { mutedAccountsManager } from "@/lib/hive/muted-accounts"
import { hasMutedTag } from "@/lib/hive/mutedTags"
import { useUserSettings } from "./useUserSettings"

interface ActiveVote {
    percent: number;
    reputation: number;
    rshares: number;
    time: string;
    voter: string;
    weight: number;
}
export interface ExtendedComment extends Comment {
    active_votes?: ActiveVote[]
    /** Vote total when the raw `active_votes` array was not serialized (the
     *  public feed seed). Cards prefer `active_votes.length` when present. */
    voteCount?: number
    replies?: ExtendedComment[]
    /** Set only by useBlendedFeed — undefined everywhere else means "snap". */
    source?: 'snap' | 'wave'
    /** Server-rendered markdown HTML for this snap's text. Present on the
     *  home seed so the client card does not need the markdown package to
     *  hydrate. Absent on client-fetched pages; those render after load. */
    bodyHtml?: string
    /** Set only by the discovery candidate routes — undefined everywhere else means "organic". */
    isDiscovery?: boolean
    discoveryReason?: 'trending' | 'category-match' | 'community-fallback' | 'resurrected'
}

interface ActiveVote {
    percent: number
    reputation: number
    rshares: number
    time: string
    voter: string
    weight: number
}

export interface ListCommentsParams {
    start: []
    limit: number
    order: string
}

async function fetchComments(
    author: string,
    permlink: string,
    recursive: boolean = false
): Promise<Comment[]> {
    try {
        /*
        const params = {
            start: [author, permlink, "", ""],
            limit: 10,
            order: "by_parent"
          };
          
        const temp = await HiveClient.call("database_api", "list_comments", params);
        console.log(temp.comments)
        const comments = temp.comments
        */

        const comments = (await HiveClient.database.call("get_content_replies", [
            author,
            permlink,
        ])) as Comment[];

        if (recursive) {
            const fetchReplies = async (comment: ExtendedComment): Promise<ExtendedComment> => {
                if (comment.children && comment.children > 0) {
                    comment.replies = await fetchComments(comment.author, comment.permlink, true);
                }
                return comment;
            };
            const commentsWithReplies = await Promise.all(comments.map(fetchReplies));
            return commentsWithReplies;
        } else {
            return comments;
        }
    } catch (error) {
        console.error("Failed to fetch comments:", error instanceof Error ? error.message : error);
        return [];
    }
}

export function useComments(
    author: string,
    permlink: string,
    recursive: boolean = false,
    username?: string
) {
    const { settings } = useUserSettings()
    // A .join(',') key, not the raw array — settings.mutedTags gets a fresh
    // array reference every time the shared settings store re-hydrates (once
    // per useUserSettings() consumer mounted anywhere on the page), which
    // would otherwise recreate fetchAndUpdateComments and re-trigger the
    // fetch effect below on every one of those unrelated mounts.
    const mutedTagsKey = settings.mutedTags.join(',');
    const [comments, setComments] = useState<Comment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // Mount fires a fetch with settings.mutedTags still at its pre-hydration
    // default ([]) — see useUserSettings, whose real localStorage read only
    // lands via a post-mount effect. That triggers a second, correctly-
    // filtered fetch once mutedTagsKey changes, but without a staleness
    // guard the first (unfiltered) call could resolve *after* the second and
    // clobber its result with unmuted-tag content. Same generation-counter
    // pattern as useSnaps.ts/useBlendedFeed.ts — only the most recently
    // *started* call's result is ever applied.
    const fetchGenerationRef = useRef(0);

    const fetchAndUpdateComments = useCallback(async (showLoader = true) => {
        // Skip fetching if author or permlink is empty
        if (!author || !permlink) {
            setIsLoading(false);
            return;
        }

        const myGeneration = ++fetchGenerationRef.current;
        const isStale = () => fetchGenerationRef.current !== myGeneration;

        if (showLoader) setIsLoading(true);
        try {
            const fetchedComments = await fetchComments(author, permlink, recursive);
            // Filter out muted accounts (recursively including nested replies)
            const mutedList = await mutedAccountsManager.getMutedList(username);
            if (isStale()) return;
            const filterMuted = (comments: ExtendedComment[]): ExtendedComment[] => {
                return comments
                    .filter((c) => !mutedList.has(c.author.toLowerCase()))
                    .filter((c) => !hasMutedTag(c.json_metadata, settings.mutedTags))
                    .map((c) => {
                        if (c.replies && c.replies.length > 0) {
                            return { ...c, replies: filterMuted(c.replies as ExtendedComment[]) };
                        }
                        return c;
                    });
            };
            const filteredComments = filterMuted(fetchedComments as ExtendedComment[]);
            // Merge: keep any recently-added optimistic comments that haven't
            // propagated to the blockchain yet so they don't disappear on refresh.
            setComments(prev => {
                const fetchedPermlinks = new Set(filteredComments.map(c => c.permlink));
                const now = Date.now();
                const pending = prev.filter(c => {
                    const ageMs = now - new Date(c.created as any).getTime();
                    return ageMs < 60_000 && !fetchedPermlinks.has(c.permlink);
                });
                return [...filteredComments, ...pending];
            });
            if (showLoader) setIsLoading(false);
        } catch (err: any) {
            if (isStale()) return;
            setError(err.message ? err.message : "Error loading comments");
            console.error(err);
            if (showLoader) setIsLoading(false);
        }
    }, [author, permlink, recursive, username, mutedTagsKey]);

    useEffect(() => {
        fetchAndUpdateComments();
    }, [fetchAndUpdateComments]);

    const addComment = useCallback((newComment: Comment) => {
        setComments((existingComments) => [...existingComments, newComment]);
    }, []);

    const updateComments = useCallback(async () => {
        await fetchAndUpdateComments(false);
    }, [fetchAndUpdateComments]);

    return {
        comments,
        error,
        isLoading,
        addComment,
        updateComments,
    };
}
