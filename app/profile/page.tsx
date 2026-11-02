'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiUser } from 'react-icons/fi';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { SessionStatus, SignInGate } from '@/components/shared/SignInGate';
import { useSnapieAuth } from '@/contexts/SnapieAuthContext';

/**
 * /profile is not an @username, so it used to match app/[username] and that
 * route returned null. The shell (nav) still rendered, and the main area was
 * empty — no profile and no sign-in prompt. Guests now get the same Log in /
 * Create account gate as /chat. A signed-in visitor is sent to /@username.
 * The modal behind Log in is the existing Google, email, and Hive wallet login.
 */
export default function ProfilePage() {
  const { isLoggedIn, username } = useCurrentUser();
  const { isLoading } = useSnapieAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn || !username) return;
    router.replace(`/@${username}`);
  }, [isLoggedIn, username, router]);

  if (isLoggedIn && username) {
    return <SessionStatus label="Opening your profile" />;
  }

  // Session restore is async (the usual 401 when there is no cookie). Hold
  // the main area until that settles so a returning visitor is not flashed
  // the guest gate on the way to their profile.
  if (isLoading) {
    return <SessionStatus label="Checking session" />;
  }

  return (
    <SignInGate
      icon={FiUser}
      title="Sign in to view your profile"
      message="Log in with Google, email, or your Hive wallet to open your profile."
    />
  );
}
