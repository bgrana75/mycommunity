import { DefaultRenderer } from "@hiveio/content-renderer";

export interface ProcessedContent {
  content: string;
  videos: { [key: string]: string };
}

/**
 * Process markdown content to extract IPFS videos and replace them with placeholders
 * @param content - Raw markdown content
 * @returns ProcessedContent with placeholders and video URL mapping
 */
export async function processMarkdownWithVideos(
  content: string
): Promise<ProcessedContent> {
  const videos: { [key: string]: string } = {};

  // Create renderer instance
  const renderer = new DefaultRenderer({
    baseUrl: "https://hive.blog/",
    breaks: true,
    skipSanitization: true,
    allowInsecureScriptTags: false,
    addNofollowToLinks: true,
    doNotShowImages: false,
    assetsWidth: 540,
    assetsHeight: 380,
    imageProxyFn: (url: string) => {
      try {
        if (url.includes('ipfs')) {
          return `https://ipfs.io/ipfs/${url.split('/ipfs/')[1]}`;
        }
        return url;
      } catch (error) {
        console.warn('Image proxy error:', error);
        return url;
      }
    },
    usertagUrlFn: (account: string) => "/@" + account,
    hashtagUrlFn: (hashtag: string) => "/explore/" + hashtag,
    isLinkSafeFn: (url: string) => true,
    addExternalCssClassToMatchingLinksFn: (url: string) => true,
    ipfsPrefix: "https://ipfs.skatehive.app",
  });

  // First, render the markdown to HTML
  let renderedContent = renderer.render(content);

  // Match video tags with IPFS sources
  const videoRegex =
    /<video[^>]*src=["']([^"']*ipfs\.skatehive\.app[^"']*)["'][^>]*>[\s\S]*?<\/video>/gi;

  let match;
  let videoIndex = 0;

  while ((match = videoRegex.exec(renderedContent)) !== null) {
    const fullVideoTag = match[0];
    const videoSrc = match[1];

    // Create a unique placeholder key
    const placeholderKey = `VIDEO_${videoIndex}`;
    videos[placeholderKey] = videoSrc;

    // Replace the entire video tag with placeholder
    renderedContent = renderedContent.replace(
      fullVideoTag,
      `[[${placeholderKey}]]`
    );

    videoIndex++;
  }

  // Also handle iframe embeds from IPFS
  const iframeRegex =
    /<iframe[^>]*src=["']([^"']*ipfs\.skatehive\.app[^"']*)["'][^>]*>[\s\S]*?<\/iframe>/gi;

  while ((match = iframeRegex.exec(renderedContent)) !== null) {
    const fullIframeTag = match[0];
    let iframeSrc = match[1];

    // Extract video URL from iframe src if it's embedded
    // Sometimes IPFS URLs are in the format: ipfs.skatehive.app/ipfs/HASH
    // We need to construct the proper video URL
    if (iframeSrc.includes("ipfs.skatehive.app")) {
      const placeholderKey = `VIDEO_${videoIndex}`;
      videos[placeholderKey] = iframeSrc;

      renderedContent = renderedContent.replace(
        fullIframeTag,
        `[[${placeholderKey}]]`
      );

      videoIndex++;
    }
  }

  return {
    content: renderedContent,
    videos,
  };
}

/**
 * Extract video hash from IPFS URL
 * @param url - IPFS video URL
 * @returns Video hash or null
 */
export function extractVideoHash(url: string): string | null {
  const ipfsMatch = url.match(/ipfs\.skatehive\.app\/ipfs\/([a-zA-Z0-9]+)/);
  return ipfsMatch ? ipfsMatch[1] : null;
}
