import type { Metadata } from 'next';
import ExploreTagPage from '@/components/explore/ExploreTagPage';
import { buildExploreTagMetadata } from '@/lib/utils/buildMetadata';
import HiveClient from '@/lib/hive/hiveclient';

interface PageProps {
  params: Promise<{ tag: string }>;
}

async function communityTitleFor(tag: string): Promise<string | null> {
  if (!/^hive-\d+$/.test(tag)) return null;
  try {
    const info = await HiveClient.call('bridge', 'get_community', { name: tag });
    return typeof info?.title === 'string' ? info.title : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const tag = decodeURIComponent(params.tag);
  const communityTitle = await communityTitleFor(tag);
  return buildExploreTagMetadata(tag, communityTitle);
}

export default async function ExploreTagRoute(props: PageProps) {
  const params = await props.params;
  const tag = decodeURIComponent(params.tag);
  return <ExploreTagPage tag={tag} />;
}
