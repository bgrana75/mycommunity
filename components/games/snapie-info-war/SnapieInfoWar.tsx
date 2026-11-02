'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useWakeLock } from "@/hooks/useWakeLock";
import type { SnapieControls, SnapieEvent, SnapieHud, SnapieMountHandle, SnapieOptions, SnapiePhase, SnapieResult } from "./types";

export interface SnapieInfoWarProps extends SnapieOptions {
  className?: string;
  /** Extra content shown under the game after a run ends (e.g. score submission). */
  resultSlot?: ReactNode;
}

const IDLE_HUD: SnapieHud = { score: 0, lives: 0, hp: 0, maxHp: 0, weapon: "STING", weaponLevel: 1, stage: 1, bossHp: null, phase: "idle" };

/**
 * React wrapper. Options are read once on mount; change `key` to remount with new options.
 * Callbacks (onEvent/onResult) always use the latest props.
 */
export const SnapieInfoWar = forwardRef<SnapieControls, SnapieInfoWarProps>(function SnapieInfoWar(props, ref) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const inst = useRef<SnapieMountHandle | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const [phase, setPhase] = useState<SnapiePhase>("idle");
  const [finished, setFinished] = useState(false);
  const { isFullscreen, supported: fullscreenSupported, toggle: toggleFullscreen } = useFullscreen(wrap);
  useWakeLock(phase === "playing");

  useImperativeHandle(ref, () => ({
    start: () => inst.current?.start(),
    pause: () => inst.current?.pause(),
    resume: () => inst.current?.resume(),
    reset: () => inst.current?.reset(),
    getPhase: (): SnapiePhase => inst.current?.getPhase() ?? "idle",
    getHud: (): SnapieHud => inst.current?.getHud() ?? IDLE_HUD,
  }), []);

  useEffect(() => {
    let cancelled = false;
    // Dynamic import keeps the canvas engine out of SSR.
    void import("./mount").then(({ mountSnapieInfoWar }) => {
      if (cancelled || !host.current) return;
      const { className: _c, resultSlot: _s, onEvent: _e, onResult: _r, ...opts } = latest.current;
      inst.current = mountSnapieInfoWar(host.current, {
        ...opts,
        onEvent: (e: SnapieEvent) => {
          if (e.type === "run-start") setFinished(false);
          if (e.type === "hud") setPhase(e.hud.phase);
          if (e.type === "game-over" || e.type === "win") setFinished(true);
          latest.current.onEvent?.(e);
        },
        // The engine captures its sessionId once at mount. The host rotates the
        // prop after every run (scores are deduped per sessionId), so stamp the
        // current one onto each result.
        onResult: (r: SnapieResult) => latest.current.onResult?.({ ...r, sessionId: latest.current.sessionId ?? r.sessionId }),
      });
    });
    return () => { cancelled = true; inst.current?.destroy(); inst.current = null; };
  }, []);

  return (
    <div
      ref={wrap}
      className={props.className}
      style={{ width: "100%", position: "relative", background: isFullscreen ? "#05000a" : undefined, display: isFullscreen ? "flex" : undefined, flexDirection: "column", justifyContent: "center", alignItems: isFullscreen ? "center" : undefined, height: isFullscreen ? "100dvh" : undefined }}
    >
      {/* Fullscreen: the largest 16:9 box that fits the screen, so the picture is
          letterboxed instead of overflowing (the controls float over the screen). */}
      <div ref={host} style={{ width: isFullscreen ? "min(100vw, calc(100dvh * 384 / 216))" : "100%" }} />
      {fullscreenSupported && (
        <button
          type="button"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={toggleFullscreen}
          style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 6, border: "1px solid #3a3150", background: "rgba(26,20,38,0.8)", color: "#ffd21f", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
        >
          {isFullscreen ? "⤡" : "⤢"}
        </button>
      )}
      {finished && props.resultSlot && (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>{props.resultSlot}</div>
      )}
    </div>
  );
});
