'use client'
import { Box, Flex } from '@chakra-ui/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import MobileHeader from '@/components/layout/MobileHeader';
import BottomTabBar from '@/components/layout/BottomTabBar';
import MeSheet from '@/components/layout/MeSheet';
import { chatService } from '@/lib/chat/ChatService';
import { chatCloseDestination } from '@/lib/chat/closeChat';
import { OPEN_CHAT_EVENT } from '@/lib/chat/openChat';
import { useHangout } from '@/contexts/HangoutContext';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useShowInterestPicker } from '@/hooks/useShowInterestPicker';
import { useContentFilterSync } from '@/hooks/useContentFilter';
import { isPointsEnabledFor } from '@/lib/points/config';
import { AiohaSessionRestore } from '@/lib/aioha/facade-react-ui';

const Sidebar = dynamic(() => import('@/components/layout/Sidebar'), { ssr: false });
const ChatPanel = dynamic(() => import('@/components/chat/ChatPanel'), { ssr: false });
const HangoutModal = dynamic(() => import('@/components/hangouts/HangoutModal'), { ssr: false });
const EmancipationBanner = dynamic(() => import('@/components/auth/EmancipationBanner'), { ssr: false });
const NeedsWalletHandler = dynamic(() => import('@/components/auth/NeedsWalletHandler'), { ssr: false });
const InterestPicker = dynamic(() => import('@/components/onboarding/InterestPicker'), { ssr: false });
const WhatsNewModal = dynamic(() => import('@/components/whatsnew/WhatsNewModal'), { ssr: false });
const PointsToaster = dynamic(() => import('@/components/points/PointsToaster'), { ssr: false });
const DebugConsole = dynamic(() => import('@/components/debug/DebugConsole'), { ssr: false });

export default function LayoutContent({
  children,
  footer,
}: {
  children: React.ReactNode;
  /** Server-rendered site footer (passed from root layout for SSR HTML). */
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isPhone = usePhoneLayout();
  const isPhoneRef = useRef(isPhone);
  isPhoneRef.current = isPhone;
  const seenPathRef = useRef<string | null>(null);
  // The document's first history entry is the landing visit. Later entries
  // created by in-app navigations are marked so Close can tell them from a
  // direct /chat visit the user backed onto. Refs stay out of render: React
  // may replay a render and a write there would not match the history entry.
  const landingHistoryRef = useRef(true);
  const historyPoppedRef = useRef(false);
  const isShortsPage = pathname === '/shorts';
  // useSearchParams() on this component bails the layout's suspense boundary
  // out to client rendering (`BAILOUT_TO_CLIENT_SIDE_RENDERING`), so the home
  // feed never makes it into the HTML. The flags are read in a nested
  // boundary instead. Defaults match a normal visit; embed/popout URLs
  // update before paint.
  const [queryFlags, setQueryFlags] = useState({ embed: false, chatPopout: false });
  const onQueryFlags = useCallback((flags: { embed: boolean; chatPopout: boolean }) => {
    setQueryFlags(prev => (prev.embed === flags.embed && prev.chatPopout === flags.chatPopout ? prev : flags));
  }, []);
  const isEmbedMode = queryFlags.embed;
  const isChatPopoutMode = queryFlags.chatPopout;
  const { activeRoom, closeRoom } = useHangout();
  const { settings } = useUserSettings();
  const { username: currentUsername } = useCurrentUser();
  // Discovery Engine Phase 2 — onboarding only ever shows while behind the
  // discovery flag (see hooks/useShowInterestPicker.ts), and only to brand-new
  // Hive accounts, server-authoritative so it doesn't reappear on a new
  // device/browser once dismissed.
  const { shouldShow: showInterestPicker, dismiss: dismissInterestPicker } = useShowInterestPicker(currentUsername);
  // Muted tags/apps: hydrate + sync across devices for the logged-in account.
  useContentFilterSync(currentUsername);
  const baseGradient = settings.colorMode === 'light'
    ? 'radial(circle at 18% 8%, rgba(3, 105, 161, 0.08), transparent 34%), radial(circle at 78% 0%, rgba(3, 105, 161, 0.05), transparent 30%), linear(to-br, #ffffff, #f8fafc 48%, #f1f5f9)'
    : 'radial(circle at 18% 8%, rgba(28, 161, 241, 0.12), transparent 34%), radial(circle at 78% 0%, rgba(28, 161, 241, 0.07), transparent 30%), linear(to-br, #080f1e, #0d1525 48%, #070d1a)';

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  // The panel chunk stays out of the first load until chat is opened, then
  // stays mounted so close/minimize does not drop the conversation.
  const [chatActivated, setChatActivated] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [isMeSheetOpen, setIsMeSheetOpen] = useState(false);
  // Desktop/tablet nav stays out of the phone hydration commit. The slot
  // reserves its width from the first paint so the feed does not jump.
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 30em)');
    const apply = () => setShowDesktopSidebar(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const popoutRef = useRef<Window | null>(null);
  if ((isChatOpen || isChatMinimized || isChatPopoutMode) && !chatActivated) {
    setChatActivated(true);
  }

  useEffect(() => {
    if (isEmbedMode) {
      document.body.classList.add('embed-mode');
    } else {
      document.body.classList.remove('embed-mode');
    }
    return () => { document.body.classList.remove('embed-mode'); };
  }, [isEmbedMode]);

  //  Polls unconditionally, including while the panel is open or minimized.
  //  It used to pause whenever isChatOpen — which stays true when the panel is
  //  minimized — and zero the count locally on open, so the badge was a local
  //  guess that read 0 through arriving DMs and then snapped back on close.
  //  Clearing is now the server's job: ChatPanel marks a conversation read and
  //  hands us the recomputed total.
  const refreshChatUnread = useCallback(async () => {
    if (isEmbedMode) return;
    setChatUnreadCount(await chatService.getUnreadCount());
  }, [isEmbedMode]);

  useEffect(() => {
    if (isEmbedMode) return;
    refreshChatUnread();
    const id = setInterval(refreshChatUnread, 30000);
    return () => clearInterval(id);
  }, [isEmbedMode, refreshChatUnread]);

  useEffect(() => {
    if (!isChatPopoutMode) return;
    setIsChatOpen(true);
    setIsChatMinimized(false);
  }, [isChatPopoutMode]);

  useEffect(() => {
    const onPop = () => { historyPoppedRef.current = true; };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (landingHistoryRef.current) {
      landingHistoryRef.current = false;
      return;
    }
    if (historyPoppedRef.current) {
      historyPoppedRef.current = false;
      return;
    }
    const current = window.history.state;
    const base = current && typeof current === 'object' ? current as Record<string, unknown> : {};
    if (base.snapieInApp === true) return;
    window.history.replaceState({ ...base, snapieInApp: true }, '');
  }, [pathname]);

  // /chat asks for the existing panel once a session exists. Guests stay on
  // the page's sign-in gate; opening the overlay on mobile would cover it.
  useEffect(() => {
    const open = () => {
      setIsChatOpen(true);
      setIsChatMinimized(false);
    };
    window.addEventListener(OPEN_CHAT_EVENT, open);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, open);
  }, []);

  // Phone chrome (header, tab bar) stays tappable, but the panel still covers
  // the page underneath it. Leaving the route has to drop the panel or the
  // next page opens hidden behind chat. Desktop keeps the panel across
  // navigations.
  useEffect(() => {
    const seen = seenPathRef.current;
    if (seen === null) {
      seenPathRef.current = pathname;
      return;
    }
    if (seen === pathname) return;
    seenPathRef.current = pathname;
    if (!isPhoneRef.current || pathname === '/chat') return;
    setIsChatOpen(false);
    setIsChatMinimized(false);
  }, [pathname]);

  const routerRef = useRef(router);
  routerRef.current = router;

  const closeChat = useCallback(() => {
    setIsChatOpen(false);
    setIsChatMinimized(false);
    // Read the viewport at click time. DevTools device mode can change the
    // width without the state hook having flushed yet.
    const phoneNow = typeof window !== 'undefined'
      && window.matchMedia('(max-width: 479px)').matches;
    const historyState = window.history.state;
    const fromInAppNavigation = !!historyState
      && typeof historyState === 'object'
      && (historyState as { snapieInApp?: unknown }).snapieInApp === true;
    const action = chatCloseDestination({
      isPhone: phoneNow,
      pathname,
      fromInAppNavigation,
    });
    if (action === 'back') routerRef.current.back();
    else if (action === 'home') routerRef.current.replace('/');
  }, [pathname]);

  // Close MeSheet when navigating
  useEffect(() => { setIsMeSheetOpen(false); }, [pathname]);

  const handlePopoutChat = useCallback(() => {
    if (typeof window === 'undefined') return;
    const width = 520;
    const height = 760;
    const left = window.screenX + Math.max(0, window.outerWidth - width - 40);
    const top = window.screenY + 40;

    if (popoutRef.current && !popoutRef.current.closed) {
      popoutRef.current.focus();
      return;
    }

    const popup = window.open(
      '/?embed=true&chat_popout=1',
      'snapie-chat-popout',
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no`
    );
    if (!popup) return;
    popoutRef.current = popup;
    setIsChatOpen(false);
    setIsChatMinimized(false);
    popup.addEventListener('beforeunload', () => {
      popoutRef.current = null;
    });
  }, []);

  // On mobile, pad content away from the fixed header and tab bar.
  // Skip padding on shorts (full-screen immersive) and embed/popout modes.
  // The header is 56px and the tab bar is 60px, but in standalone mode their
  // safe-area padding (see MobileHeader / BottomTabBar) grows them by the
  // notch and home-indicator insets. Content has to clear that same inset,
  // plus a bit of breathing room under the tab bar, or the last bit of a
  // short page (e.g. a post's only comment) ends up permanently hidden
  // behind the fixed bar with nowhere left to scroll to reveal it.
  // env(safe-area-inset-*) is 0 in a normal browser tab.
  const mobilePaddingTop = !isEmbedMode && !isChatPopoutMode && !isShortsPage ? { base: 'calc(56px + env(safe-area-inset-top))', sm: '0' } : undefined;
  const mobilePaddingBottom = !isEmbedMode && !isChatPopoutMode && !isShortsPage ? { base: 'calc(76px + env(safe-area-inset-bottom))', sm: '0' } : undefined;

  return (
    <Box
      bg="background"
      color="text"
      minH="100dvh"
      bgGradient={baseGradient}
    >
      <AiohaSessionRestore />
      <Suspense fallback={null}>
        <LayoutQueryFlags onChange={onQueryFlags} />
      </Suspense>
      <Box maxW="1320px" mx="auto" h="100dvh">
        <Flex direction={{ base: 'column', sm: 'row' }} h="100dvh">
          {!isEmbedMode && !isChatPopoutMode && (
            <div className={pathname === '/compose' ? 'snapie-sidebar-slot is-compact' : 'snapie-sidebar-slot'}>
              {showDesktopSidebar && (
                <Sidebar isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} chatUnreadCount={chatUnreadCount} />
              )}
            </div>
          )}
          <Box
            id="app-scroll-container"
            flex="1"
            h="100dvh"
            overflowY="auto"
            pt={mobilePaddingTop}
          >
            {/* Deliberately NOT display=flex/flexDirection=column: this box's
                children (EmancipationBanner, the routed page, the spacer
                below) were flex items of a fixed-height flex container, so
                flexbox's default shrink resolved the routed page's box to
                ~viewport height regardless of its actual content — any
                overflow was still painted (visible), but anything placed
                after it in flex order landed layered inside that overflow
                instead of truly after it, so it never extended scrollHeight.
                Plain block flow lets each child's real content height push
                the next one down, which the spacer below depends on. */}
            <EmancipationBanner />
            {!isChatPopoutMode && children}
            <NeedsWalletHandler />
            {/* Hive.io SEO backlink — in scroll flow so it never covers the
                composer, chat, or BottomTabBar. Hidden in embed/popout/shorts. */}
            {!isEmbedMode && !isChatPopoutMode && !isShortsPage && footer}
            {/* A real element, not padding-bottom on the scroll container —
                some browsers don't extend an overflow:auto element's
                scrollHeight to include its own trailing padding, so a page
                whose content ends close to one viewport tall (e.g. a post
                with a single comment) could never actually scroll far enough
                to clear the fixed BottomTabBar. */}
            {mobilePaddingBottom && (
              <Box h={mobilePaddingBottom} aria-hidden />
            )}
          </Box>
        </Flex>
      </Box>

      {!isEmbedMode && !isChatPopoutMode && (
        <>
          {/* Mobile chrome */}
          <MobileHeader onMePress={() => setIsMeSheetOpen(true)} />
          <BottomTabBar />
          <MeSheet
            isOpen={isMeSheetOpen}
            onClose={() => setIsMeSheetOpen(false)}
            onToggleChat={() => setIsChatOpen(c => !c)}
            chatUnreadCount={chatUnreadCount}
          />

          {/* Chat panel (all screen sizes). Loaded on first open. */}
          {chatActivated && <ChatPanel
            isOpen={isChatOpen}
            onClose={closeChat}
            isMinimized={isChatMinimized}
            onMinimize={() => setIsChatMinimized(true)}
            onRestore={() => { setIsChatMinimized(false); setIsChatOpen(true); }}
            onPopout={handlePopoutChat}
            onUnreadChange={setChatUnreadCount}
          />}
        </>
      )}
      {isChatPopoutMode && chatActivated && (
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            if (typeof window !== 'undefined') window.close();
          }}
          isMinimized={false}
          isPopoutWindow
        />
      )}
      {!isEmbedMode && activeRoom && (
        <HangoutModal isOpen onClose={closeRoom} roomName={activeRoom} />
      )}
      {!isEmbedMode && !isChatPopoutMode && showInterestPicker && (
        <InterestPicker onDone={dismissInterestPicker} />
      )}
      {/* "What's new" changelog — everyone, not just the discovery allowlist,
          but never stacked on top of the onboarding picker. */}
      {!isEmbedMode && !isChatPopoutMode && !showInterestPicker && <WhatsNewModal />}
      {/* Snapie Points earn-toaster — allowlist-gated dogfood (Stage 1). */}
      {!isEmbedMode && !isChatPopoutMode && isPointsEnabledFor(currentUsername) && <PointsToaster />}
      {/* Opt-in mobile debug console (?debug=1) — see components/debug/DebugConsole.tsx. */}
      <DebugConsole />
    </Box>
  );
}

/** Matches BottomTabBar / MobileHeader, which render only below the `sm` breakpoint (480px). */
function usePhoneLayout() {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 479px)');
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    window.addEventListener('resize', apply);
    return () => {
      mq.removeEventListener('change', apply);
      window.removeEventListener('resize', apply);
    };
  }, []);
  return isPhone;
}

function LayoutQueryFlags({ onChange }: { onChange: (flags: { embed: boolean; chatPopout: boolean }) => void }) {
  const searchParams = useSearchParams();
  const embed = searchParams.get('embed') === 'true';
  const chatPopout = searchParams.get('chat_popout') === '1';
  useLayoutEffect(() => {
    onChange({ embed, chatPopout });
  }, [embed, chatPopout, onChange]);
  return null;
}
