import { findPosts } from "@/lib/hive/client-functions";
import { Discussion } from "@hiveio/dhive";
import { useEffect, useState } from "react";

export default function usePosts(query: string, params: any[]) {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleGetPosts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const posts = await findPosts(query, params);
        setPosts(posts);
      } catch (e) {
        console.error(e);
        setError("Error loading posts!");
      } finally {
        setIsLoading(false);
      }
    };
    handleGetPosts();
  }, [query, params]);
  return { posts, isLoading, error };
}
