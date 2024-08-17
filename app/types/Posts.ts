// types/Post.ts
export interface Post {
    abs_rshares: number;
    active: string;
    active_votes: any[]; // Define a more specific type if you have one
    allow_curation_rewards: boolean;
    allow_replies: boolean;
    allow_votes: boolean;
    author: string;
    author_reputation: string;
    author_rewards: number;
    beneficiaries: any[]; // Define a more specific type if you have one
    body: string;
    body_length: number;
    cashout_time: string;
    category: string;
    children: number;
    children_abs_rshares: number;
    created: string;
    curator_payout_value: string;
    depth: number;
    id: number;
    json_metadata: {
        app: string;
        format: string;
        description: string;
        tags: string[];
        users: string[];
        links: string[];
        image: string[];
    };
    last_payout: string;
    last_update: string;
    max_accepted_payout: string;
    max_cashout_time: string;
    net_rshares: number;
    net_votes: number;
    parent_author: string;
    parent_permlink: string;
    pending_payout_value: string;
    percent_hbd: number;
    permlink: string;
    promoted: string;
    reblogged_by: any[]; // Define a more specific type if you have one
    replies: any[]; // Define a more specific type if you have one
    reward_weight: number;
    root_author: string;
    root_permlink: string;
    root_title: string;
    title: string;
    total_payout_value: string;
    total_pending_payout_value: string;
    total_vote_weight: number;
    url: string;
    vote_rshares: number;
}
