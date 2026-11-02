import { describe, it, expect } from 'vitest';
import { chatCloseDestination } from './closeChat';

describe('chatCloseDestination', () => {
  it('sends a phone /chat visit back when this entry was opened in-app', () => {
    expect(chatCloseDestination({
      isPhone: true,
      pathname: '/chat',
      fromInAppNavigation: true,
    })).toBe('back');
  });

  it('sends a phone /chat visit home when the entry was a direct visit', () => {
    expect(chatCloseDestination({
      isPhone: true,
      pathname: '/chat',
      fromInAppNavigation: false,
    })).toBe('home');
  });

  it('only hides the panel for a drawer on another page or on desktop', () => {
    expect(chatCloseDestination({
      isPhone: true,
      pathname: '/games',
      fromInAppNavigation: true,
    })).toBe('stay');
    expect(chatCloseDestination({
      isPhone: false,
      pathname: '/chat',
      fromInAppNavigation: true,
    })).toBe('stay');
  });
});
