import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

// /@username must keep rendering the profile view. A segment that does not
// start with @ is not a profile, so it must 404 (not render an empty 200 page).

vi.mock('../[...slug]/views/ProfileView', () => ({
  default: function ProfileView() {
    return null;
  },
}));

vi.mock('../[...slug]/metadata', () => ({
  metadataForSlug: vi.fn(async () => ({})),
}));

import ProfileRoute, { generateMetadata } from './page';
import { metadataForSlug } from '../[...slug]/metadata';

function usernameProp(element: unknown): string | null {
  if (!element || typeof element !== 'object' || !('props' in element)) return null;
  const props = (element as { props?: { username?: string } }).props;
  return props?.username ?? null;
}

function usernameParams(username: string) {
  return { params: Promise.resolve({ username }) };
}

describe('[username] profile route', () => {
  it('renders the profile view for an @username', async () => {
    const element = await ProfileRoute(usernameParams('@alice'));
    expect(usernameProp(element)).toBe('alice');
  });

  it('decodes an encoded @username before rendering', async () => {
    const element = await ProfileRoute(usernameParams('%40bob'));
    expect(usernameProp(element)).toBe('bob');
  });

  it('returns a 404 for a segment that is not an @username', async () => {
    await expect(ProfileRoute(usernameParams('wallet'))).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(ProfileRoute(usernameParams('alice'))).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('still builds metadata from the @username segment', async () => {
    await generateMetadata(usernameParams('@alice'));
    expect(metadataForSlug).toHaveBeenCalledWith(['@alice']);
  });
});
