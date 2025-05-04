# My Community 

> MyCommunity is a versatile React template designed for effortlessly deploying your Hive-based community website.

# Run Locally 

## Install Packages

```bash
pnpm i
```

## Config .Env

```bash
NEXT_PUBLIC_THEME=nounish # Choose between available themes or make your own
NEXT_PUBLIC_HIVE_COMMUNITY_TAG=hive-173115 #skatehive
NEXT_PUBLIC_HIVE_SEARCH_TAG=hive-173115 #skatehive
NEXT_PUBLIC_THREAD_AUTHOR=peak.snaps # so the app can read snaps from peakd
NEXT_PUBLIC_THREAD_PERMLINK=re-skatedev-sidr6t # the permlink of the thread post (Read the threadpost section)
NEXT_PUBLIC_HIVE_USER=skatedev # dummy user to sign the image uploads
HIVE_POSTING_KEY=posting_private_key_here # dummy posting key for sign image uploads on hive
NEXT_PUBLIC_SITE_TYPE=business # leave it empty for hiding store section, type business to have a store session
```

> Available Themes: bluesky / cannabis / forest / hacker / hivebr / nounish / windows95

** TODO:[Explain how the Thread of posts work in the setup section]

## Run locally 

```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.


## Deploy on Vercel

The easiest way to deploy your community app is in Vercel. 

## 1) Login in Vercel 

## 2) [Click here](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2Fsktbrd%2Fmycommunity&hasTrialAvailable=0&showOptionalTeamCreation=false&project-name=mycommunity&framework=nextjs&totalProjects=1&remainingProjects=1&teamSlug=sktbrds-projects) 

## 3) Copy and paste the .env in Vercel Enviroment variables 

```bash
NEXT_PUBLIC_THEME=nounish
NEXT_PUBLIC_HIVE_COMMUNITY_TAG=hive-163772
NEXT_PUBLIC_HIVE_SEARCH_TAG=hive-163772
NEXT_PUBLIC_THREAD_AUTHOR=peak.snaps
NEXT_PUBLIC_PARENT_PERM=nxvsjarvmp
NEXT_PUBLIC_HIVE_USER=skatedev
HIVE_POSTING_KEY=posting_private_key_here
NEXT_PUBLIC_SITE_TYPE=business
``` 

4) Hit Deploy button !