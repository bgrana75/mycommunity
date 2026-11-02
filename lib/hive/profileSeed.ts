import HiveClient from '@/lib/hive/hiveclient';
import { withTimeout } from '@/lib/utils/withTimeout';

const SEED_TIMEOUT_MS = 2000;

export interface ProfileSeedAccount {
    name: string;
    witness_votes?: string[];
}

/**
 * Enough of a profile for the header to be in the first HTML. The page
 * otherwise waits on a client mute-check and account fetch, and the largest
 * text then appears only after those round-trips. Desktop Lighthouse
 * sometimes picks a snap paragraph from that late paint and, once the node
 * is gone, scores it several seconds late.
 */
export async function loadProfileSeed(username: string): Promise<{
    account: ProfileSeedAccount;
    profile: unknown;
} | null> {
    try {
        return await withTimeout(lookup(username), SEED_TIMEOUT_MS);
    } catch (error) {
        console.error('Profile seed failed', error);
        return null;
    }
}

/**
 * True when Hive has an account, false when it does not, 'unknown' when the
 * node is unreachable. Used to hard-404 missing profiles without 404ing on a
 * slow seed timeout for a real account.
 */
export async function accountExists(username: string): Promise<boolean | 'unknown'> {
    try {
        const accounts = await HiveClient.database.getAccounts([username]);
        return Boolean(Array.isArray(accounts) && accounts[0]);
    } catch {
        return 'unknown';
    }
}

async function lookup(username: string) {
    const [accounts, profile] = await Promise.all([
        HiveClient.database.getAccounts([username]),
        HiveClient.call('bridge', 'get_profile', { account: username, observer: '' }),
    ]);
    const account = Array.isArray(accounts) ? accounts[0] : null;
    if (!account || !profile) return null;
    return {
        account: {
            name: account.name,
            witness_votes: account.witness_votes ?? [],
        },
        profile,
    };
}
