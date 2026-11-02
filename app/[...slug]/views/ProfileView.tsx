import { notFound } from 'next/navigation';
import ProfilePage from '@/components/profile/ProfilePage';
import { accountExists, loadProfileSeed } from '@/lib/hive/profileSeed';

export default async function ProfileView({ username }: { username: string }) {
  const seed = await loadProfileSeed(username);
  if (!seed) {
    // Seed null means timeout or missing. Only hard-404 when the account
    // truly does not exist — a slow node should not 404 a real profile.
    if ((await accountExists(username)) === false) notFound();
  }
  return (
    <ProfilePage
      username={username}
      initialAccount={seed?.account ?? null}
      initialProfile={seed?.profile ?? null}
    />
  );
}
