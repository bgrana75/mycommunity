import { Comment } from "@hiveio/dhive";

export function organizeCommentsByLatest(comments: Comment[]): Comment[] {
    // First, sort the comments by depth and creation date
    comments.sort((a, b) => {
        // If depths are different, prioritize lower depth (higher priority to depth 1)
        if (a.depth !== b.depth) {
            return a.depth - b.depth;
        }
        // If depths are the same, sort by created date in descending order (most recent first)
        return new Date(b.created).getTime() - new Date(a.created).getTime();
    });

    // Next, link the depth 2 comments to their corresponding depth 1 comment
    const organizedComments: Comment[] = [];
    const commentMap = new Map<string, Comment[]>();

    comments.forEach(comment => {
        if (comment.depth === 1) {
            // Add depth 1 comments directly to the organized array
            organizedComments.push(comment);
            commentMap.set(comment.permlink, []);
        } else if (comment.depth >= 2) {
            // Add depth 2 comments under their parent permlink
            const parentPermlink = comment.parent_permlink;
            if (commentMap.has(parentPermlink)) {
                commentMap.get(parentPermlink)?.push(comment);
            }
        }
    });

    // Flatten the organized comments, including replies under their parent
    const finalComments: Comment[] = [];
    organizedComments.forEach(comment => {
        finalComments.push(comment);
        if (commentMap.has(comment.permlink)) {
            finalComments.push(...(commentMap.get(comment.permlink) || []));
        }
    });

    return finalComments;
}