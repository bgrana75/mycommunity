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
NEXT_PUBLIC_THREAD_AUTHOR=skatedev # the author of the thread post*
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

[Deploy in Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) 

## Business Setup 

- Distriator Api 
- Setup Products list 