'use client';

import { useEffect, useState } from "react";
import { Box, VStack, Text } from "@chakra-ui/react";
import Tweet from "./Tweet";
import { Comment } from "@hiveio/dhive";

interface TweetListProps {
  initialComments: Comment[];
}

export default function TweetList({ initialComments }: TweetListProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [batch, setBatch] = useState(1);
  const [hasNewComments, setHasNewComments] = useState(false);
  const [firstPermlink, setFirstPermlink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Set firstPermlink when initial comments are available
  useEffect(() => {
    if (initialComments.length > 0) {
      setFirstPermlink(initialComments[0].permlink);
    }
  }, [initialComments]);

  // Load more comments when scroll down
  const loadMoreComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/comments?batch=${batch}`);
      const data = await response.json();
      const newComments: Comment[] = data.comments;
      setComments(prevComments => [...prevComments, ...newComments]);
      setBatch(batch + 1);
    } catch (error) {
      console.error("Failed to load more comments", error);
    }
    setLoading(false);
  };

 // Polling for new comments
 useEffect(() => {
  const intervalId = setInterval(async () => {
    const response = await fetch('/api/comments?batch=0');
    const data = await response.json();
    if (data.comments.length > 0 && data.comments[0].permlink !== firstPermlink) {
      setHasNewComments(true);
      handleLoadNewComments();
    }
  }, Number(process.env.NEXT_PUBLIC_FETCH_NEW_COMMENTS_INTERVAL) || 60000); // Poll new messages every minute

  return () => clearInterval(intervalId); // Cleanup on unmount
}, [firstPermlink]);

const handleLoadNewComments = async () => {
  const response = await fetch('/api/comments?batch=0');
  const data = await response.json();
  setComments((prevComments) => [...data.comments, ...prevComments]);
  setFirstPermlink(data.comments[0].permlink);
  setHasNewComments(false);
};

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop ===
        document.documentElement.offsetHeight
      ) {
        loadMoreComments();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [batch]);

  return (
    <Box>
      <Text align="right">Sort comments by <b>latest</b></Text>

      {hasNewComments && (
        <div onClick={handleLoadNewComments} style={{ cursor: 'pointer', color: 'blue' }}>
          New comments available! Loading...
        </div>
      )}

      <VStack spacing={4} align="stretch">
        {comments.map(comment => (
          <Tweet key={comment.permlink} comment={comment} />
        ))}
      </VStack>
      {loading && <Text>Loading more comments...</Text>}
    </Box>
  );
}
