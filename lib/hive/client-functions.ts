'use client';
import { Broadcast, Custom, KeychainKeyTypes, KeychainRequestResponse, KeychainSDK, Login, Post, Transfer, Vote, WitnessVote } from "keychain-sdk";
import HiveClient from "./hiveclient";
import crypto from 'crypto';
import { signImageHash } from "./server-functions";
import { Discussion, Notifications } from "@hiveio/dhive";
import { extractNumber } from "../utils/extractNumber";
import { profileEnd } from "console";

interface HiveKeychainResponse {
  success: boolean
  publicKey: string
}

const communityTag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG;

export async function vote(props: Vote): Promise<KeychainRequestResponse> {
  const keychain = new KeychainSDK(window)

  const result = await keychain.vote({
    username: props.username,
    permlink: props.permlink,
    author: props.author,
    weight: props.weight,
  } as Vote);
  return result;
}

export async function commentWithKeychain(formParamsAsObject: any): Promise<HiveKeychainResponse | undefined> {

  const keychain = new KeychainSDK(window);
  const post = await keychain.post(formParamsAsObject.data as Post);
  if (post) {
    console.log('post', post);
    return {
      success: true,
      publicKey: String(post.publicKey)
    }
  } else {
    return {
      success: false,
      publicKey: 'deu merda'
    }

  }
}

export async function loginWithKeychain(username: string) {
  try {
    const memo = `${username} signed up with skatehive app at ${Date.now()}`
    const keychain = new KeychainSDK(window);
    undefined
    const formParamsAsObject = {
      "data": {
        "username": username,
        "message": memo,
        "method": KeychainKeyTypes.posting,
        "title": "Login"
      }
    }

    const login = await keychain
      .login(
        formParamsAsObject.data as Login);
    return({ login });
  } catch (error) {
    console.log({ error });
  }
}

export function getReputation(rep: number) {
  let out = ((Math.log10(Math.abs(rep)) - 9) * 9) + 25;
  out = Math.round(out);
  return out;
}

export async function transferWithKeychain(username: string, destination: string, amount: string, memo: string, currency: string) {
  try {
    const keychain = new KeychainSDK(window);

    const formParamsAsObject = {
      "data": {
        "username": username,
        "to": destination,
        "amount": amount,
        "memo": memo,
        "enforce": false,
        "currency": currency,
      }
    }

    const transfer = await keychain
      .transfer(
        formParamsAsObject.data as Transfer);
    console.log({ transfer });
  } catch (error) {
    console.log({ error });
  }
}

export async function updateProfile(username: string, name: string, about: string, location: string, coverImageUrl: string, avatarUrl: string, website: string) {
  try {
    const keychain = new KeychainSDK(window);

    const profileMetadata = {
      profile: {
        name: name,
        about: about,
        location: location,
        cover_image: coverImageUrl,
        profile_image: avatarUrl,
        website: website,
        version: 2
      }
    };

    const formParamsAsObject = {
      data: {
        username: username,
        operations: [
          [
            'account_update2',
            {
              account: username,
              posting_json_metadata: JSON.stringify(profileMetadata),
              extensions: []
            }
          ]
        ],
        method: KeychainKeyTypes.active,
      },
    };

    const broadcast = await keychain.broadcast(formParamsAsObject.data as unknown as Broadcast);
    console.log('Broadcast success:', broadcast);
  } catch (error) {
    console.error('Profile update failed:', error);
  }
}

export async function checkCommunitySubscription(username: string) {

  const parameters = {
    account: username
  }
  try {
    const subscriptions = await HiveClient.call('bridge', 'list_all_subscriptions', parameters);
    return subscriptions.some((subscription: any) => subscription[0] === communityTag);
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return false; // Returning false in case of an error
  }
}

export async function communitySubscribeKeyChain(username: string) {

  const keychain = new KeychainSDK(window);
  const json = [
    'subscribe',
    {
      community: communityTag
    }
  ]
  const formParamsAsObject = {
    data: {
      username: username,
      id: "community",
      method: KeychainKeyTypes.posting,
      json: JSON.stringify(json)
    },
  };
  try {
    const custom = await keychain.custom(formParamsAsObject.data as unknown as Custom);
    //const broadcast = await keychain.broadcast(formParamsAsObject.data as unknown as Broadcast);
    console.log('Broadcast success:', custom);
  } catch (error) {
    console.error('Profile update failed:', error);
  }
}

export async function checkFollow(follower: string, following: string): Promise<boolean> {
  try {
    const status = await HiveClient.call('bridge', 'get_relationship_between_accounts', [
      follower,
      following
    ]);
    if (status.follows) {
      return true
    } else {
      return false
    }
  } catch (error) {
    console.log(error)
    return false
  }
}

export async function changeFollow(follower: string, following: string) {
  const keychain = new KeychainSDK(window);
  const status = await checkFollow(follower, following)
  let type = ''
  if (status) {
    type = ''
  } else {
    type = 'blog'
  }
  const json = JSON.stringify([
    'follow',
    {
      follower: follower,
      following: following,
      what: [type], //null value for unfollow, 'blog' for follow
    },
  ]);

  const formParamsAsObject = {
    data: {
      username: follower,
      id: "follow",
      method: KeychainKeyTypes.posting,
      json: JSON.stringify(json)
    },
  };
  try {
    const custom = await keychain.custom(formParamsAsObject.data as unknown as Custom);
    //const broadcast = await keychain.broadcast(formParamsAsObject.data as unknown as Broadcast);
    console.log('Broadcast success:', custom);
  } catch (error) {
    console.error('Profile update failed:', error);
  }

}

export async function witnessVoteWithKeychain(username: string, witness: string) {
  const keychain = new KeychainSDK(window);
  try {
    const formParamsAsObject = {
      "data": {
        "username": username,
        "witness": "skatehive",
        "vote": true
      }
    };
    const witnessvote = await keychain
      .witnessVote(
        formParamsAsObject.data as WitnessVote);
    console.log({ witnessvote });
  } catch (error) {
    console.log({ error });
  }
}

export function getFileSignature (file: File): Promise<string> {
  return new Promise<string>(async (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async () => {
          if (reader.result) {
              const content = Buffer.from(reader.result as ArrayBuffer);
              const hash = crypto.createHash('sha256')
                  .update('ImageSigningChallenge')
                  .update(content)
                  .digest('hex');
              try {
                  const signature = await signImageHash(hash);
                  resolve(signature);
              } catch (error) {
                  console.error('Error signing the hash:', error);
                  reject(error);
              }
          } else {
              reject(new Error('Failed to read file.'));
          }
      };
      reader.onerror = () => {
          reject(new Error('Error reading file.'));
      };
      reader.readAsArrayBuffer(file);
  });
}

export async function uploadImage(file: File, signature: string, index?: number, setUploadProgress?: React.Dispatch<React.SetStateAction<number[]>>): Promise<string> {

  const signatureUser = process.env.NEXT_PUBLIC_HIVE_USER

  const formData = new FormData();
        formData.append("file", file, file.name);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://images.hive.blog/' + signatureUser + '/' + signature, true);

            if (index && setUploadProgress) {
              xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
                      const progress = (event.loaded / event.total) * 100;
                      setUploadProgress((prevProgress: number[]) => {
                          const updatedProgress = [...prevProgress];
                          updatedProgress[index] = progress;
                          return updatedProgress;
                      });
                  }
              }
            }

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response.url);
                } else {
                    reject(new Error('Failed to upload image'));
                }
            };

            xhr.onerror = () => {
                reject(new Error('Failed to upload image'));
            };

            xhr.send(formData);
        });
}

export async function getPost(user: string, postId: string) {
    const postContent = await HiveClient.database.call('get_content', [
      user,
      postId,
    ]);
    if (!postContent) throw new Error('Failed to fetch post content');

    return postContent as Discussion;
}

export function getPayoutValue(post: any): string {
    const createdDate = new Date(post.created);
    const now = new Date();
    
    // Calculate the time difference in days
    const timeDifferenceInMs = now.getTime() - createdDate.getTime();
    const timeDifferenceInDays = timeDifferenceInMs / (1000 * 60 * 60 * 24);
    
    if (timeDifferenceInDays >= 7) {
      // Post is older than 7 days, return the total payout value
      return post.total_payout_value.replace(" HBD", "");
    } else if (timeDifferenceInDays < 7) {
      // Post is less than 7 days old, return the pending payout value
      return post.pending_payout_value.replace(" HBD", "");
    } else {
      return "0.000"
    }
}

export async function findLastNotificationsReset(username: string, start = -1, loopCount = 0): Promise<string> {
  if (loopCount >= 5) {
    return '1970-01-01T00:00:00Z';
  }

  try {
    const params = {
      account: username,
      start: start,
      limit: 1000,
      include_reversible: true,
      operation_filter_low: 262144,
    };

    const transactions = await HiveClient.call('account_history_api', 'get_account_history', params);
    const history = transactions.history.reverse();
      
    if (history.length === 0) {
      return '1970-01-01T00:00:00Z';
    }
    
    for (const item of history) {
      if (item[1].op.value.id === 'notify') {
        const json = JSON.parse(item[1].op.value.json);
        return json[1].date;
      }
    }

    return findLastNotificationsReset(username, start - 1000, loopCount + 1);

  } catch (error) {
    console.log(error);
    return '1970-01-01T00:00:00Z';
  }
}

export async function fetchNewNotifications(username: string) {
  try {
    const notifications: Notifications[] = await HiveClient.call('bridge', 'account_notifications', { account: username, limit: 100 });
    const lastDate = await findLastNotificationsReset(username);

    if (lastDate) {
      const filteredNotifications = notifications.filter(notification => new Date(notification.date + 'Z').toISOString() > new Date(lastDate).toISOString());
      return filteredNotifications;
    } else {
      return notifications;
    }
  } catch (error) {
    console.log('Error:', error);
    return [];
  }
}

export async function convertVestToHive (amount: number) {
  const globalProperties = await HiveClient.call('condenser_api', 'get_dynamic_global_properties', []);
  const totalVestingFund = extractNumber(globalProperties.total_vesting_fund_hive)
  const totalVestingShares = extractNumber(globalProperties.total_vesting_shares)
  const vestHive = ( totalVestingFund * amount ) / totalVestingShares
  return vestHive
}

export async function getProfile (username: string) {
  const profile = await HiveClient.call('bridge', 'get_profile', {account: username});
  return profile
}

export async function getCommunityInfo (username: string) {
  const profile = await HiveClient.call('bridge', 'get_community', {name: username});
  return profile
}

export async function findPosts(query: string, params: any[]) {
      const by = 'get_discussions_by_' + query;
      const posts = await HiveClient.database.call(by, params);
  return posts
}



