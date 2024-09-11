// app/page.tsx
'use client';

import PostPage from "../components/blog/PostPage";
import ProfilePage from "../components/profile/ProfilePage";

interface HomePageProps {
  params: {
    slug: string[];
  };
}

export default function HomePage({ params }: HomePageProps) {

    console.log(params.slug.length)

    if (params.slug.length === 1 && decodeURIComponent(params.slug[0]).startsWith('@')) {
      return (
        <ProfilePage username={decodeURIComponent(params.slug[0]).substring(1)} />
      )
    } else if (params.slug.length === 2 && decodeURIComponent(params.slug[0]).startsWith('@')) {
      return (
        <PostPage author={decodeURIComponent(params.slug[0]).substring(1)} permlink={params.slug[1]} />
      )
    } else if (params.slug.length === 3 && decodeURIComponent(params.slug[1]).startsWith('@')) {
      return (
        <PostPage author={decodeURIComponent(params.slug[1]).substring(1)} permlink={params.slug[2]} />
      )
    }

  return (
    <></>

  );
}
