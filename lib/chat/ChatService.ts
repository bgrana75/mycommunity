'use client';

export interface Channel {
  _id: string;
  name: string;
  description?: string;
  type: string;
  conversationKind?: 'channel' | 'group';
  owner?: string;
  members?: string[];
  memberCount: number;
  isPublic: boolean;
}

export interface Message {
  _id: string;
  sender: string;
  content: string;
  replyTo?: string | null;
  editedAt?: string | null;
  createdAt: string;
  /** Usernames mentioned in `content`, extracted server-side at write time. */
  mentions?: string[];
  /** Sender of the message this replies to, denormalized server-side. */
  replyToSender?: string | null;
}

export interface DmDeliveryInfo {
  hasFcm: boolean;
  memoSuggested: boolean;
  cooldownMs: number;
}

export interface DmStatusInfo {
  meSeenAt: string;
  peerSeenAt: string | null;
  peerLastSeenAt: string | null;
  peerOnline: boolean;
}

export interface TypingStatusInfo {
  users: string[];
  ttlMs: number;
}

export interface Conversation {
  _id: string;
  name: string;
  description?: string;
  type: 'channel' | 'group' | 'dm';
  isPublic: boolean;
  owner?: string;
  members?: string[];
  memberCount?: number;
  peer?: string;
  lastMessage?: Message | null;
  unread?: boolean;
  /** Unread messages in this conversation. Sums across conversations to the
   *  badge count — both come from the same server-side counter. */
  unreadCount?: number;
}

/** Badge total plus its per-conversation breakdown. */
export interface UnreadSnapshot {
  total: number;
  byConversation: Record<string, number>;
}

export const EMPTY_UNREAD_SNAPSHOT: UnreadSnapshot = { total: 0, byConversation: {} };

export interface ChatPreferences {
  mutedUsers: string[];
  blockedUsers: string[];
}

const TOKEN_KEY = 'hive-chat-token';
const TOKEN_USER_KEY = 'hive-chat-token-user';
const BASE = '/api/chat';

// Duplicated from lib/points/client.ts's jwtExpiryMs (not imported — that
// module imports chatService from here, so importing back would be
// circular). Same tiny, deliberately-not-trust-bearing freshness check: the
// server verifies for real, this just avoids sending a request with a token
// we can already tell is dead.
function jwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

class ChatService {
  private token: string | null = null;
  private tokenUsername: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
      this.tokenUsername = localStorage.getItem(TOKEN_USER_KEY);
    }
  }

  /** Current token, re-read from localStorage rather than trusting the
   *  in-memory field — another module (lib/points/client.ts's
   *  ensureSessionToken, shared session token) can refresh the same
   *  localStorage key independently of this class, and without this,
   *  ChatService kept using its own stale in-memory copy until a full page
   *  reload, even after a fresh token existed. Also treats an expired token
   *  as absent, so a doomed request is never even attempted (this is what
   *  was producing the repeated /api/chat/unread 401 spam — a token expired
   *  mid-session and nothing ever reloaded it here). */
  private currentToken(): string | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return null;
    const exp = jwtExpiryMs(stored);
    if (exp !== null && exp <= Date.now()) return null;
    this.token = stored;
    return stored;
  }

  isAuthenticated(): boolean {
    return !!this.currentToken();
  }

  /** Owner of the stored session token. Re-read from localStorage for the
   *  same reason as currentToken(): other modules (points' ensureSessionToken,
   *  authenticatedFetch) delete `hive-chat-token` without touching
   *  `hive-chat-token-user`, so the in-memory copy kept naming an owner for a
   *  token that no longer exists. No stored token means no owner. */
  getTokenUsername(): string | null {
    if (typeof window === 'undefined') return this.tokenUsername;
    if (!localStorage.getItem(TOKEN_KEY)) {
      this.tokenUsername = null;
      return null;
    }
    this.tokenUsername = localStorage.getItem(TOKEN_USER_KEY);
    return this.tokenUsername;
  }

  async authenticate(
    username: string,
    signMessage: (msg: string) => Promise<string>
  ): Promise<void> {
    const { challenge } = await this.post<{ challenge: string }>(
      `${BASE}/auth/challenge`,
      { username },
      false
    );
    const signature = await signMessage(challenge);
    const { token } = await this.post<{ token: string }>(
      `${BASE}/auth/verify`,
      { username, challenge, signature },
      false
    );
    this.token = token;
    this.tokenUsername = username;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_USER_KEY, username);
  }

  logout(): void {
    this.token = null;
    this.tokenUsername = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_USER_KEY);
  }

  async getChannels(): Promise<Channel[]> {
    const { channels } = await this.get<{ channels: Channel[] }>(`${BASE}/channels`, false);
    return channels;
  }

  async getConversations(): Promise<Conversation[]> {
    const { conversations } = await this.get<{ conversations: Conversation[] }>(`${BASE}/conversations`, true);
    return conversations;
  }

  async getDmMessages(
    conversationId: string,
    opts: { before?: string; after?: string; limit?: number } = {}
  ): Promise<{ messages: Message[]; status?: DmStatusInfo | null }> {
    const params = new URLSearchParams();
    if (opts.before) params.set('before', opts.before);
    if (opts.after) params.set('after', opts.after);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const { messages, status } = await this.get<{ messages: Message[]; status?: DmStatusInfo | null }>(
      `${BASE}/dm/${conversationId}/messages${qs ? `?${qs}` : ''}`,
      true
    );
    return { messages, status };
  }

  async sendDmMessage(conversationId: string, content: string, replyTo?: string): Promise<Message> {
    const { message } = await this.post<{ message: Message }>(
      `${BASE}/dm/${conversationId}/messages`,
      { content, replyTo: replyTo || null },
      true
    );
    return message;
  }

  async sendDmMessageWithDelivery(
    conversationId: string,
    content: string,
    replyTo?: string
  ): Promise<{ message: Message; delivery?: DmDeliveryInfo }> {
    return this.post<{ message: Message; delivery?: DmDeliveryInfo }>(
      `${BASE}/dm/${conversationId}/messages`,
      { content, replyTo: replyTo || null },
      true
    );
  }

  async editDmMessage(conversationId: string, messageId: string, content: string): Promise<Message> {
    const { message } = await this.request<{ message: Message }>(
      `${BASE}/dm/${conversationId}/messages`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, content }),
      },
      true
    );
    return message;
  }

  async openDm(targetUser: string): Promise<Conversation> {
    const { conversation } = await this.post<{ conversation: Conversation }>(
      `${BASE}/dm`,
      { targetUser },
      true
    );
    return conversation;
  }

  async createGroup(payload: { name: string; description?: string; isPublic?: boolean; members?: string[] }): Promise<Channel> {
    const { group } = await this.post<{ group: Channel }>(`${BASE}/groups`, payload, true);
    return group;
  }

  async getGroups(): Promise<Channel[]> {
    const { groups } = await this.get<{ groups: Channel[] }>(`${BASE}/groups`, true);
    return groups;
  }

  async addGroupMember(groupId: string, member: string): Promise<Channel> {
    const { group } = await this.post<{ group: Channel }>(
      `${BASE}/groups/${groupId}/members`,
      { member },
      true
    );
    return group;
  }

  async removeGroupMember(groupId: string, member: string): Promise<Channel> {
    const { group } = await this.request<{ group: Channel }>(
      `${BASE}/groups/${groupId}/members`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member }),
      },
      true
    );
    return group;
  }

  async markDmMemoFallbackSent(conversationId: string): Promise<void> {
    await this.post(`${BASE}/dm/${conversationId}/memo-fallback`, { success: true }, true);
  }

  async getPreferences(): Promise<ChatPreferences> {
    return this.get<ChatPreferences>(`${BASE}/preferences`, true);
  }

  async muteUser(username: string): Promise<void> {
    await this.post(`${BASE}/preferences`, { action: 'mute', target: username }, true);
  }

  async unmuteUser(username: string): Promise<void> {
    await this.post(`${BASE}/preferences`, { action: 'unmute', target: username }, true);
  }

  async blockUser(username: string): Promise<void> {
    await this.post(`${BASE}/preferences`, { action: 'block', target: username }, true);
  }

  async unblockUser(username: string): Promise<void> {
    await this.post(`${BASE}/preferences`, { action: 'unblock', target: username }, true);
  }

  async getMessages(
    channelId: string,
    opts: { before?: string; after?: string; limit?: number } = {}
  ): Promise<Message[]> {
    const params = new URLSearchParams();
    if (opts.before) params.set('before', opts.before);
    if (opts.after) params.set('after', opts.after);
    if (opts.limit) params.set('limit', String(opts.limit));
    const qs = params.toString();
    const { messages } = await this.get<{ messages: Message[] }>(
      `${BASE}/channels/${channelId}/messages${qs ? `?${qs}` : ''}`,
      true
    );
    return messages;
  }

  async sendMessage(channelId: string, content: string, replyTo?: string): Promise<Message> {
    const { message } = await this.post<{ message: Message }>(
      `${BASE}/channels/${channelId}/messages`,
      { content, replyTo: replyTo || null },
      true
    );
    return message;
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<Message> {
    const { message } = await this.request<{ message: Message }>(
      `${BASE}/channels/${channelId}/messages`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, content }),
      },
      true
    );
    return message;
  }

  async joinChannel(channelId: string): Promise<void> {
    await this.post(`${BASE}/channels/${channelId}/join`, {}, true);
  }

  async leaveChannel(channelId: string): Promise<void> {
    await this.post(`${BASE}/channels/${channelId}/leave`, {}, true);
  }

  async registerDevice(fcmToken: string): Promise<void> {
    await this.post(`${BASE}/register-device`, { fcmToken }, true);
  }

  async getUnread(): Promise<UnreadSnapshot> {
    if (!this.currentToken()) return EMPTY_UNREAD_SNAPSHOT;
    try {
      const { unread, conversations } = await this.get<{
        unread: number;
        conversations: Record<string, number>;
      }>(`${BASE}/unread`, true);
      return { total: unread || 0, byConversation: conversations || {} };
    } catch {
      return EMPTY_UNREAD_SNAPSHOT;
    }
  }

  async getUnreadCount(): Promise<number> {
    return (await this.getUnread()).total;
  }

  /** Tell the server this conversation has actually been read, and get the
   *  recomputed badge back in the same round trip so it clears immediately
   *  instead of on the next poll tick. Null on failure — the caller must leave
   *  the badge alone rather than assume zero. */
  async markRead(conversationId: string): Promise<UnreadSnapshot | null> {
    if (!this.currentToken()) return null;
    try {
      const { unread, conversations } = await this.post<{
        unread: number;
        conversations: Record<string, number>;
      }>(`${BASE}/read`, { conversationId }, true);
      return { total: unread || 0, byConversation: conversations || {} };
    } catch {
      return null;
    }
  }

  async setTyping(conversationId: string, isTyping: boolean): Promise<void> {
    await this.post(`${BASE}/typing`, { conversationId, isTyping }, true);
  }

  async getTyping(conversationId: string): Promise<TypingStatusInfo> {
    const qs = new URLSearchParams({ conversationId }).toString();
    return this.get<TypingStatusInfo>(`${BASE}/typing?${qs}`, true);
  }

  private async get<T>(url: string, auth: boolean): Promise<T> {
    return this.request<T>(url, { method: 'GET' }, auth);
  }

  private async post<T>(url: string, body: unknown, auth: boolean): Promise<T> {
    return this.request<T>(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      auth
    );
  }

  private async request<T>(url: string, opts: RequestInit, auth: boolean, retry = true): Promise<T> {
    const headers: Record<string, string> = {
      // Declares that this client posts its own read receipts, so the server
      // skips the legacy "fetching a conversation marks it read" behaviour it
      // still applies for older @snapie/chat-client builds.
      'X-Snapie-Chat-Read-Mode': 'explicit',
      ...(opts.headers as Record<string, string>),
    };
    const token = auth ? this.currentToken() : null;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { ...opts, headers });

    if (res.status === 401 && auth && retry) {
      // Token expired — caller should re-authenticate. Only clear it for
      // mutations (explicit user actions): GETs back passive/interval polling
      // (unread badge, typing status, message deltas) that runs continuously
      // in the background, and a stray 401 there shouldn't nuke a token that's
      // shared with points — that silently re-triggers the Keychain "Enable
      // Snapie Points" prompt on the user's next unrelated vote/comment.
      if (opts.method !== 'GET') {
        this.token = null;
        localStorage.removeItem(TOKEN_KEY);
      }
      throw new Error('CHAT_UNAUTHORIZED');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  }
}

export const chatService = new ChatService();
