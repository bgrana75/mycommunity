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

