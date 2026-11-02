'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPost } from '@/lib/hive/client-functions';
import { playNotificationChime } from '@/lib/utils/notificationChime';

const VISIBLE_POLL_MS = 4_000;
const HIDDEN_POLL_MS = 15_000;
// Replies we just posted ourselves shouldn't beep or badge — suppress for the
// window in which the own-reply refetch lands.
const OWN_REPLY_SUPPRESS_MS = 8_000;
const NEAR_TOP_PX = 160;
const SCROLL_CONTAINER_ID = 'app-scroll-container';

interface UseSnapCastProps {
  author: string;
  permlink: string;
  enabled: boolean;
  sound: boolean;
  /** Silent refetch of the thread (useComments.updateComments). */
  updateComments: () => Promise<void> | void;
}

/**
 * Client-only "live" mode for a thread: polls the root's descendant count
 * (`children`) and refetches the replies when it grows. Counts new replies
 * for a "N new snaps" pill only while the reader is scrolled away from the
 * top, so reading is never interrupted.
 */
export function useSnapCast({ author, permlink, enabled, sound, updateComments }: UseSnapCastProps) {
  const [newCount, setNewCount] = useState(0);
  const lastChildrenRef = useRef<number | null>(null);
  const suppressUntilRef = useRef(0);
  const soundRef = useRef(sound);
  const updateRef = useRef(updateComments);
  soundRef.current = sound;
  updateRef.current = updateComments;

  const markOwnReply = useCallback(() => {
    suppressUntilRef.current = Date.now() + OWN_REPLY_SUPPRESS_MS;
  }, []);

  const scrollToTop = useCallback(() => {
    document.getElementById(SCROLL_CONTAINER_ID)?.scrollTo({ top: 0, behavior: 'smooth' });
    setNewCount(0);
  }, []);

  useEffect(() => {
    if (!enabled || !author || !permlink) {
      lastChildrenRef.current = null;
      setNewCount(0);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const nextDelay = () => (document.visibilityState === 'hidden' ? HIDDEN_POLL_MS : VISIBLE_POLL_MS);

    async function poll() {
      try {
        const root = await getPost(author, permlink);
        if (cancelled) return;
        const children = root.children ?? 0;
        const prev = lastChildrenRef.current;
        lastChildrenRef.current = children;
        if (prev !== null && children > prev) {
          await updateRef.current();
          if (cancelled) return;
          if (Date.now() >= suppressUntilRef.current) {
            const el = document.getElementById(SCROLL_CONTAINER_ID);
            const nearTop = !el || el.scrollTop < NEAR_TOP_PX;
            if (!nearTop) setNewCount(c => c + (children - prev));
            if (soundRef.current) playNotificationChime();
          }
        }
      } catch {
        // transient RPC failure — try again next tick
      }
      if (!cancelled) timer = setTimeout(poll, nextDelay());
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, author, permlink]);

  // Scrolling back to the top counts as having seen the new snaps.
  useEffect(() => {
    if (!enabled || newCount === 0) return;
    const el = document.getElementById(SCROLL_CONTAINER_ID);
    if (!el) return;
    const onScroll = () => { if (el.scrollTop < NEAR_TOP_PX) setNewCount(0); };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [enabled, newCount]);

  return { newCount, scrollToTop, markOwnReply };
}
