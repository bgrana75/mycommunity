import type { Metadata } from "next";
import { extractImageUrls } from "./extractImageUrls";
import { getHiveAvatarUrl } from "./avatarUtils";
import { decodeHtmlEntities } from "./htmlEntities";

const SITE_NAME = "Snapie";
const MAX_DESCRIPTION_LENGTH = 200;

function stripMarkdown(text: string): string {
  const stripped = text
    .replace(/<[^>]+>/g, ' ')                // HTML tags, including malformed ones like "<center <div ...>"
    .replace(/!\s*\[.*?\]\s*\(.*?\)/g, '')   // remove images (tolerates stray whitespace, e.g. "! [alt] (url)")
    .replace(/\[([^\]]*)\]\s*\(.*?\)/g, '$1') // links → text only
    .replace(/https?:\/\/\S+/g, '')          // bare (non-markdown) URLs, e.g. a raw video-embed link
    .replace(/\|/g, ' ')                     // markdown table pipes
    .replace(/[#*>`~_\-]/g, '');             // strip markdown chars
  return decodeHtmlEntities(stripped).replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

function extractOgImage(body: string, jsonMetadata?: string): string | undefined {
  // 1. Try json_metadata.image first
  try {
    const meta = JSON.parse(jsonMetadata || '{}');
    if (Array.isArray(meta.image) && meta.image.length > 0) {
      return meta.image[0];
    }
  } catch {}

  // 2. Fall back to first image in markdown body
  const bodyImages = extractImageUrls(body);
  if (bodyImages.length > 0) {
    return bodyImages[0];
  }

  // 3. Extract thumbnail from a 3Speak video embed
  const threeSpeakMatch = body.match(
    /https?:\/\/(?:play\.)?3speak\.tv\/(?:watch|embed)\?v=([^/"&\s]+)\/([^/"&\s]+)/
  );
  if (threeSpeakMatch) {
    return `https://img.3speakcontent.com/${threeSpeakMatch[1]}/${threeSpeakMatch[2]}/thumbnail.png`;
  }

  return undefined;
}

export function buildPostMetadata(post: {
  title: string;
  body: string;
  author: string;
  permlink: string;
  json_metadata?: string;
}): Metadata {
  const title = post.title || `Post by @${post.author}`;
  const plainText = stripMarkdown(post.body);
  const description = truncate(plainText || `Post by @${post.author}`, MAX_DESCRIPTION_LENGTH);

  let ogImage = extractOgImage(post.body, post.json_metadata);

  // Proxy through Hive images for consistent sizing (URL-encode for proxy path)
  if (ogImage) {
    ogImage = `https://images.hive.blog/1200x630/${ogImage}`;
  } else {
    // Fallback to author avatar
    ogImage = getHiveAvatarUrl(post.author, 'large');
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/@${post.author}/${post.permlink}`,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export function buildProfileMetadata(profile: {
  name: string;
  about?: string;
  metadata?: { profile?: { cover_image?: string; profile_image?: string; about?: string } };
}): Metadata {
  const about = profile.metadata?.profile?.about || profile.about || `@${profile.name} on Snapie`;
  const description = truncate(about, MAX_DESCRIPTION_LENGTH);

  const profileImage = profile.metadata?.profile?.profile_image || getHiveAvatarUrl(profile.name, 'large');
  const coverImage = profile.metadata?.profile?.cover_image;
  const ogImage = coverImage || profileImage;

  const title = `@${profile.name}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `/@${profile.name}`,
      siteName: SITE_NAME,
      images: ogImage ? [{ url: ogImage }] : [],
    },
    twitter: {
      card: coverImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}
