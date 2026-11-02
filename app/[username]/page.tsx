import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { metadataForSlug } from '../[...slug]/metadata';
import ProfileView from '../[...slug]/views/ProfileView';

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  return metadataForSlug([params.username]);
}

export default async function ProfileRoute(props: PageProps) {
  const params = await props.params;
  const username = decodeURIComponent(params.username);
  if (!username.startsWith('@')) notFound();
  return <ProfileView username={username.substring(1)} />;
}
