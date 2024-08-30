import { NextResponse } from 'next/server';
import HiveClient from "@/lib/hive/hiveclient";
import { Comment } from "@hiveio/dhive";
import { organizeCommentsByLatest } from '@/lib/organizeComments';

const publicThreadAuthor = process.env.NEXT_PUBLIC_THREAD_AUTHOR || 'skatedev';
const publicThreadPermLink = process.env.NEXT_PUBLIC_THREAD_PERMLINK || 'test-post-for-new-community';

const fetchNewCommentsIntervalTime = Number(process.env.NEXT_PUBLIC_FETCH_NEW_COMMENTS_INTERVAL) || 60000;

let cachedComments: Comment[] = [];
let fetchingInProgress = false;
let lastCommentAuthor: string | null = null;
let lastCommentPermlink: string | null = null;

var newCommentsSetup: boolean = false;  //does we need this?

const fetchCommentsFromHive = async (startAuthor: string | null, startPermlink: string | null): Promise<Comment[]> => {
    const paramsFetchTweets = {
        start: [
          publicThreadAuthor,
          publicThreadPermLink,
          startAuthor || '',
          startPermlink || ''
        ],
        limit: 500,
        order: "by_root",
    };

    console.warn("Requesting Hive RPC API");
    console.dir(paramsFetchTweets);

    const commentsResponse = await HiveClient.call(
        "database_api",
        "list_comments",
        paramsFetchTweets
    ) as { comments: Comment[] };

    return commentsResponse.comments;
};

const startFetchingNewCommentsInterval = (): any => {
    if (newCommentsSetup) return; //does we need this? looks like no....

    
    setInterval(async () => {
        newCommentsSetup = true;
        if (!fetchingInProgress) 
            await fetchAndPrependNewComments();
    }, fetchNewCommentsIntervalTime);
};

startFetchingNewCommentsInterval();  //start interval

const fetchAndPrependNewComments = async (): Promise<void> => {
    const newComments = await fetchCommentsFromHive(lastCommentAuthor, lastCommentPermlink);
  
    if (newComments.length > 1) {
      // Remove the first comment from newComments (the duplicate)
      newComments.shift();

      // Prepend new comments to cachedComments
      cachedComments = [...cachedComments, ...newComments ];
  
      // Update the lastCommentAuthor and lastCommentPermlink
      const lastComment = cachedComments[cachedComments.length - 1];
      lastCommentAuthor = lastComment.author;
      lastCommentPermlink = lastComment.permlink;
  
      console.log(`Prepended ${newComments.length} new comments.`);
    } else {
      console.log('No new comments to prepend.');
    }
  };
  

const fetchAllComments = async (): Promise<void> => {
    if (fetchingInProgress) return;

    fetchingInProgress = true;
    let hasMoreComments = true;

    while (hasMoreComments) {
        const comments = await fetchCommentsFromHive(lastCommentAuthor, lastCommentPermlink);

        if (comments.length === 0) {
            hasMoreComments = false;
        } else {
            cachedComments = [...cachedComments, ...comments];
            
            const lastComment = comments[comments.length - 1];
            lastCommentAuthor = lastComment.author;
            lastCommentPermlink = lastComment.permlink;

            console.log(`Fetched ${comments.length} comments.`);
            console.log(`Last author: ${lastCommentAuthor}, last permlink: ${lastCommentPermlink}`);

            if (comments.length < 500) {
                hasMoreComments = false;
            }
        }
    }

    fetchingInProgress = false;
    console.log('All comments fetched and cached.');
};

export async function GET(request: Request) {
    if (cachedComments.length === 0) {
        console.warn("cachedComments.length == 0");
        await fetchAllComments();
    }

    const { searchParams } = new URL(request.url);
    const batch = searchParams.get('batch');
    console.log(`batch: ${batch}`);
    const batchSize = 10;
    const start = batch ? parseInt(batch, 10) * batchSize : 0;
    console.log(`start: ${start}`);
    const end = start + batchSize;
    console.log(`end: ${end}`);

    const slicedComments = organizeCommentsByLatest(cachedComments).slice(start, end);
    console.log(`slicedComments.length: ${slicedComments.length}`);

    console.log(`startFetchingNewCommentsInterval();`);
    return NextResponse.json({ comments: slicedComments });
}
