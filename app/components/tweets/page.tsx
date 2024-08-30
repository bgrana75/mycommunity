import TweetList from "./TweetList";
import { Comment } from "@hiveio/dhive";

async function fetchInitialComments(): Promise<Comment[]> {
  const response = await fetch(`http://localhost:3000/api/comments?batch=0`, {
    next: { 
      revalidate: Number(process.env.NEXT_PUBLIC_FETCH_NEW_COMMENTS_INTERVAL || 60000)/1000 //seconds
    }, // Revalidate every 60 seconds
  });
  const data = await response.json();
  return data.comments;
}

export default async function TweetPage() {
  const initialComments = await fetchInitialComments();
  return <TweetList initialComments={initialComments} />
}

