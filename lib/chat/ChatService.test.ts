// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { chatService } from './ChatService';

// #267: other modules (lib/points/client.ts) delete `hive-chat-token` without
// touching `hive-chat-token-user`, and the in-memory username survived that.
// ChatPanel compares the owner with the logged-in user to decide whether to
// log out, so a phantom owner could wipe state for a token that was gone.

describe('chatService.getTokenUsername', () => {
  beforeEach(() => localStorage.clear());

  it('reads the owner from storage', () => {
    localStorage.setItem('hive-chat-token', 'a.b.c');
    localStorage.setItem('hive-chat-token-user', 'alice');
    expect(chatService.getTokenUsername()).toBe('alice');
  });

  it('has no owner once the token was removed by another module', () => {
    localStorage.setItem('hive-chat-token', 'a.b.c');
    localStorage.setItem('hive-chat-token-user', 'alice');
    expect(chatService.getTokenUsername()).toBe('alice');

    localStorage.removeItem('hive-chat-token');
    expect(chatService.getTokenUsername()).toBeNull();
  });

  it('follows an account switch made outside this module', () => {
    localStorage.setItem('hive-chat-token', 'a.b.c');
    localStorage.setItem('hive-chat-token-user', 'alice');
    expect(chatService.getTokenUsername()).toBe('alice');

    localStorage.setItem('hive-chat-token-user', 'bob');
    expect(chatService.getTokenUsername()).toBe('bob');
  });
});
