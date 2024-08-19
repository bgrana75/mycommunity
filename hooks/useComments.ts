'use client'
import HiveClient from "@/lib/hive/hiveclient"
import { useCallback, useEffect, useState } from "react"
import { Comment } from "@hiveio/dhive"

interface ExtendedComment extends Comment {
    replies?: ExtendedComment[]
}

interface ActiveVote {
    percent: number
    reputation: number
    rshares: number
    time: string
    voter: string
    weight: number
}

async function fetchComments(
    author: string,
    permlink: string,
    recursive: boolean = false
): Promise<Comment[]> {
    try {
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
        console.error("Failed to fetch comments:", error);
        return [];
    }
}

export function useComments(
    author: string,
    permlink: string,
    recursive: boolean = false
) {
    const [comments, setComments] = useState<Comment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAndUpdateComments = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedComments = await fetchComments(author, permlink, recursive);
            setComments(fetchedComments);
            setIsLoading(false);
        } catch (err: any) {
            setError(err.message ? err.message : "Error loading comments");
            console.error(err);
            setIsLoading(false);
        }
    }, [author, permlink, recursive]);

    useEffect(() => {
        fetchAndUpdateComments();
    }, [fetchAndUpdateComments]);

    const addComment = useCallback((newComment: Comment) => {
        setComments((existingComments) => [...existingComments, newComment]);
    }, []);

    const updateComments = useCallback(async () => {
        await fetchAndUpdateComments();
    }, [fetchAndUpdateComments]);

    return {
        comments,
        error,
        isLoading,
        addComment,
        updateComments,
    };
}
