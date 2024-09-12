'use server';

import { PrivateKey } from '@hiveio/dhive';
import { Buffer } from 'buffer';

import { DefaultRenderer } from "@hiveio/content-renderer";

export async function signImageHash(hash: string): Promise<string> {
    const wif = process.env.HIVE_POSTING_KEY;

    if (!wif) {
        throw new Error("HIVE_POSTING_KEY is not set in the environment");
    }

    const key = PrivateKey.fromString(wif);
    const hashBuffer = Buffer.from(hash, 'hex');  // Convert the hex string back to a buffer
    const signature = key.sign(hashBuffer);

    return signature.toString();
}

export async function markdownRenderer(markdown: string) {
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
        ipfsPrefix: "https://ipfs.io/ipfs/" // IPFS gateway to display ipfs images
    });
    
    const safeHtmlStr = renderer.render(markdown);
    return safeHtmlStr    
}
