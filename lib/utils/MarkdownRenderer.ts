import { DefaultRenderer } from "@hiveio/content-renderer";

export default function markdownRenderer(markdown: string) {

    const renderer = new DefaultRenderer({
        baseUrl: "https://hive.blog/",
        breaks: true,
        skipSanitization: false,
        allowInsecureScriptTags: false,
        addNofollowToLinks: true,
        doNotShowImages: false,
        assetsWidth: 640,
        assetsHeight: 480,
        imageProxyFn: (url: string) => url,
        usertagUrlFn: (account: string) => "/@" + account,
        hashtagUrlFn: (hashtag: string) => "/trending/" + hashtag,
        isLinkSafeFn: (url: string) => true,
        addExternalCssClassToMatchingLinksFn: (url: string) => true,
        ipfsPrefix: "https://ipfs.skatehive.app" // IPFS gateway to display ipfs images
    });

    const safeHtmlStr = renderer.render(markdown);

    return safeHtmlStr
}

function transformIPFSContent(content: string): string {
    const regex = /<iframe src="https:\/\/ipfs\.skatehive\.app\/ipfs\/([a-zA-Z0-9-?=&]+)"(?:(?!<\/iframe>).)*\sallowfullscreen><\/iframe>/g;

    return content.replace(regex, (match, videoID) => {
        return `<video controls muted loop> 
                  <source src="https://ipfs.skatehive.app/ipfs/${videoID}" type="video/mp4">
                  <source src="https://ipfs.skatehive.app/ipfs/${videoID}" type="video/quicktime">
              </video>`;
    });
}