'use client';
import { useEffect, useRef } from 'react';
import { createTouchOverlay, type TouchOverlayHandle, type TouchOverlayOptions } from './touchOverlay';

interface TouchControlsProps extends TouchOverlayOptions {
  /** True while the game's root element is fullscreen: controls float over the screen instead of sitting in a bar. */
  fullscreen: boolean;
}

/**
 * React wrapper for the shared touch overlay (see docs/games-mobile.md). Render it
 * inside the game's fullscreen root, where the old control bar used to be.
 * The control layout is read once; press/release always use the latest props.
 */
export function TouchControls(props: TouchControlsProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const overlay = useRef<TouchOverlayHandle | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const { dpad, actions, system } = latest.current;
    const o = createTouchOverlay(host.current, {
      dpad, actions, system,
      press: (c) => latest.current.press(c),
      release: (c) => latest.current.release(c),
      onTouch: () => latest.current.onTouch?.(),
    });
    o.setMode(latest.current.fullscreen ? 'overlay' : 'bar');
    overlay.current = o;
    return () => { o.destroy(); overlay.current = null; };
  }, []);

  useEffect(() => { overlay.current?.setMode(props.fullscreen ? 'overlay' : 'bar'); }, [props.fullscreen]);

  return <div ref={host} />;
}
