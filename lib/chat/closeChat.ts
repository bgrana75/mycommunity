/**
 * Where mobile /chat should go when the panel closes.
 * Desktop and in-page drawers stay put; the shell just hides the panel.
 * A phone visit to /chat itself has covered the tab bar, so closing has to
 * leave that route: back when this history entry was opened from another
 * Snapie page, or home when it was opened directly (including when the user
 * later backed onto that direct visit).
 */
export type ChatCloseDestination = 'stay' | 'back' | 'home';

export function chatCloseDestination(input: {
  isPhone: boolean;
  pathname: string;
  /** True when the current history entry was created by an in-app navigation. */
  fromInAppNavigation: boolean;
}): ChatCloseDestination {
  if (!input.isPhone || input.pathname !== '/chat') return 'stay';
  if (input.fromInAppNavigation) return 'back';
  return 'home';
}
