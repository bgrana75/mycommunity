// lib/hive/server-functions.ts
'use server';

import { PrivateKey, KeyRole, Operation } from '@hiveio/dhive';
import { Buffer } from 'buffer';
import nodemailer from 'nodemailer';
import HiveClient from "./hiveclient";

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

export async function sendInvite(email: string, url: string): Promise<void> {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('Email environment variables (EMAIL_HOST, EMAIL_USER, EMAIL_PASS) must be set.');
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',  // This automatically sets host, port, and security settings for Gmail
        auth: {
          user: process.env.EMAIL_USER,  // Your Gmail address
          pass: process.env.EMAIL_PASS,  // App password or your Gmail password if "less secure apps" is enabled
        },
      });
    
      // Email options
      const mailOptions = {
        from: process.env.EMAIL_USER, // Sender address
        to: email, // Recipient address
        subject: 'Hive Invitation', // Subject link
        html: `<p>Click the following link to create your account:</p><a href="${url}">${url}</a>`, // Email body with reset link
      };
    
      // Send the email
      const mail = await transporter.sendMail(mailOptions);
      //console.log(mail)
      return
}

export const generatePassword = async () => {
    const array = new Uint32Array(10);
    crypto.getRandomValues(array);
  
    const key = PrivateKey.fromSeed(array.toString()).toString();
    return key.substring(0, 25);
}
  
export const getPrivateKeys = async (username: string, password: string, roles = ['owner', 'active', 'posting', 'memo']) => {
    const privKeys = {} as any;
    roles.forEach((role) => {
        privKeys[role] = PrivateKey.fromLogin(username, password, role as KeyRole).toString();
        privKeys[`${role}Pubkey`] = PrivateKey.from(privKeys[role]).createPublic().toString();
    });
  
    return privKeys;
};

export async function createAccount(username: string, password: string) {
    // Get private and public keys
    const keys = await getPrivateKeys(username, password);
    const { ownerPubkey, activePubkey, postingPubkey, memoPubkey } = keys;

    // Create the operation array
    const op: Operation = [
        'create_claimed_account',
        {
            creator: process.env.ACCOUNT_CREATOR, // Creator account
            new_account_name: username, // New account name
            owner: {
                weight_threshold: 1,
                account_auths: [],
                key_auths: [[ownerPubkey, 1]], // Owner public key
            },
            active: {
                weight_threshold: 1,
                account_auths: [],
                key_auths: [[activePubkey, 1]], // Active public key
            },
            posting: {
                weight_threshold: 1,
                account_auths: [],
                key_auths: [[postingPubkey, 1]], // Posting public key
            },
            memo_key: memoPubkey, // Memo public key (no object here, just the public key string)
            json_metadata: '', // Optional metadata
            extensions: [] // Optional extensions
        },
    ];

    // Broadcast the operation using HiveClient
    try {
        if (process.env.ACCOUNT_KEY) await HiveClient.broadcast.sendOperations([op], PrivateKey.from(process.env.ACCOUNT_KEY));
        console.log('Account created successfully');
    } catch (error) {
        console.error('Error creating account:', error);
    }
}

