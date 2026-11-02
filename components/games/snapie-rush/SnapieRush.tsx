'use client';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { VIEW_H, VIEW_W, createEngine, type SnapieRushEngine } from "./game/engine";
import { useFullscreen, usePortraitOrientation } from "@/hooks/useFullscreen";
import { TouchControls } from "../shared/TouchControls";
import { useWakeLock } from "@/hooks/useWakeLock";
import type {
  SnapieControls,
  SnapieEvent,
  SnapieOptions,
  SnapieResult,
  SnapieRushHud,
} from "./types";

const PIXEL_FONT = "'Press Start 2P', ui-monospace, monospace";
const SHELL = "#1a1c2c";
const LIGHT = "#f4f4f4";
const ORANGE = "#ef7d57";
const GREEN = "#38b764";
const CYAN = "#41ead4";

export type SnapieRushProps = SnapieOptions & {
  className?: string;
  /** Extra content on the game-over / win screen (e.g. score submission). */
  resultSlot?: ReactNode;
};

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ width: 64, height: 8, background: "#33344a", border: `1px solid ${SHELL}` }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          height: "100%",
          background: color,
        }}
      />
    </div>
  );
}

export const SnapieRush = forwardRef<SnapieControls, SnapieRushProps>(function SnapieRush(
  {
    playerName,
    sessionId,
    startStage = 0,
    autoStart = false,
    showMenus = true,
    showTouchControls = "auto",
    keyboard = true,
    maxWidth = 640,
    onEvent,
    onResult,
    className,
    resultSlot,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SnapieRushEngine | null>(null);
  const inputRef = useRef({ left: false, right: false, accel: false, brake: false });
  // The engine is created once, but the host issues a fresh sessionId after each
  // run (scores are deduped per sessionId). Read it through this ref at result
  // time instead of capturing the first value.
  const cbRef = useRef<{
    onEvent: ((e: SnapieEvent) => void) | undefined;
    onResult: ((r: SnapieResult) => void) | undefined;
    playerName: string | undefined;
    sessionId: string | undefined;
  }>({ onEvent, onResult, playerName, sessionId });
  cbRef.current = { onEvent, onResult, playerName, sessionId };

  const [hud, setHud] = useState<SnapieRushHud | null>(null);
  const [phase, setPhase] = useState<string>("idle");
  const [lastResult, setLastResult] = useState<SnapieResult | null>(null);
  const [touch, setTouch] = useState(showTouchControls === true);

  const { isFullscreen, supported: fullscreenSupported, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const isPortrait = usePortraitOrientation();
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);
  useWakeLock(phase === "running");

  useEffect(() => {
    if (showTouchControls === "auto") {
      setTouch(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
    } else {
      setTouch(showTouchControls);
    }
  }, [showTouchControls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createEngine(canvas, {
      get playerName() {
        return cbRef.current.playerName;
      },
      get sessionId() {
        return cbRef.current.sessionId;
      },
      onEvent: (e) => {
        cbRef.current.onEvent?.(e);
        if (e.type === "hud") setHud(e.hud as SnapieRushHud);
        if (e.type === "game-over" || e.type === "win") setLastResult(e.result);
        setPhase(engineRef.current?.getPhase() ?? "idle");
      },
      onResult: (r) => cbRef.current.onResult?.(r),
    });
    engineRef.current = engine;
    setHud(engine.getHud() as SnapieRushHud);
    if (autoStart) {
      engine.start(startStage);
      setPhase("running");
    }
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncInput = useCallback(() => {
    engineRef.current?.setInput({ ...inputRef.current });
  }, []);

  useEffect(() => {
    if (!keyboard) return;
    const set = (key: string, down: boolean) => {
      const k = key.length === 1 ? key.toLowerCase() : key;
      if (k === "ArrowLeft" || k === "a") inputRef.current.left = down;
      else if (k === "ArrowRight" || k === "d") inputRef.current.right = down;
      else if (k === "ArrowUp" || k === "w") inputRef.current.accel = down;
      else if (k === "ArrowDown" || k === "s") inputRef.current.brake = down;
      else return false;
      syncInput();
      return true;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        const engine = engineRef.current;
        if (!engine) return;
        if (engine.getPhase() === "running") engine.pause();
        else if (engine.getPhase() === "paused") engine.resume();
        setPhase(engine.getPhase());
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        const engine = engineRef.current;
        if (engine && (engine.getPhase() === "idle" || engine.getPhase() === "game-over" || engine.getPhase() === "win")) {
          engine.start(startStage);
          setPhase("running");
          setLastResult(null);
          e.preventDefault();
        }
        return;
      }
      if (set(e.key, true)) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => set(e.key, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [keyboard, startStage, syncInput]);

  useImperativeHandle(
    ref,
    (): SnapieControls => ({
      start: (s) => {
        engineRef.current?.start(s ?? startStage);
        setLastResult(null);
        setPhase("running");
      },
      pause: () => {
        engineRef.current?.pause();
        setPhase("paused");
      },
      resume: () => {
        engineRef.current?.resume();
        setPhase("running");
      },
      reset: () => {
        engineRef.current?.reset();
        setPhase("idle");
      },
      getPhase: () => engineRef.current?.getPhase() ?? "idle",
      getHud: () => engineRef.current?.getHud() ?? null,
    }),
    [startStage],
  );

  const hold = (side: "left" | "right" | "accel" | "brake", down: boolean) => {
    inputRef.current[side] = down;
    syncInput();
  };

  const startRun = () => {
    engineRef.current?.start(startStage);
    setLastResult(null);
    setPhase("running");
  };

  const idle = phase === "idle";
  const over = phase === "game-over" || phase === "win";

  return (
    <div
      ref={rootRef}
      className={className}
      style={
        isFullscreen
          ? {
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100dvh",
              display: "flex",
              flexDirection: "column",
              fontFamily: PIXEL_FONT,
              color: LIGHT,
              userSelect: "none",
              touchAction: "manipulation",
              background: SHELL,
            }
          : {
              width: "100%",
              maxWidth,
              margin: "0 auto",
              fontFamily: PIXEL_FONT,
              color: LIGHT,
              userSelect: "none",
              touchAction: "manipulation",
            }
      }
    >
      {showMenus && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 10px",
            background: SHELL,
            border: `2px solid ${CYAN}`,
            borderBottom: "none",
            fontSize: 8,
            lineHeight: 1.6,
          }}
        >
          <span style={{ color: ORANGE }}>{hud?.stageName ?? "SNAPIE RUSH"}</span>
          <span>{String(hud?.score ?? 0).padStart(6, "0")}</span>
          <span style={{ color: ORANGE }}>{"♥".repeat(Math.max(0, hud?.hearts ?? 0)) || "—"}</span>
          {fullscreenSupported && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              style={{
                fontFamily: PIXEL_FONT,
                fontSize: 9,
                color: CYAN,
                background: "transparent",
                border: `1px solid ${CYAN}`,
                padding: "3px 6px",
                cursor: "pointer",
              }}
            >
              {isFullscreen ? "⤡" : "⤢"}
            </button>
          )}
        </div>
      )}

      <div
        style={{
          position: "relative",
          background: SHELL,
          border: `2px solid ${CYAN}`,
          lineHeight: 0,
          ...(isFullscreen
            ? { flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }
            : null),
        }}
      >
        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          style={
            isFullscreen
              ? {
                  // Bounded by the container on both axes and letterboxed, so the
                  // road isn't cut off in landscape fullscreen (same fix as the
                  // other games).
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  imageRendering: "pixelated",
                }
              : {
                  width: "100%",
                  height: "auto",
                  display: "block",
                  imageRendering: "pixelated",
                  aspectRatio: `${VIEW_W} / ${VIEW_H}`,
                }
          }
        />

        {isFullscreen && isPortrait && isTouch && (
          // Non-blocking nudge: some phones ignore the landscape lock (iOS never
          // implements it), but the game stays playable in portrait.
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              zIndex: 3,
              pointerEvents: "none",
              textAlign: "center",
              padding: "6px 8px",
              fontSize: 8,
              lineHeight: 1.6,
              color: LIGHT,
              background: "rgba(18,19,31,0.85)",
            }}
          >
            ROTATE YOUR DEVICE FOR THE FULL EXPERIENCE
          </div>
        )}

        {(idle || over) && showMenus && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: idle ? "flex-end" : "center",
              paddingBottom: idle ? 26 : 12,
              gap: 12,
              background: idle ? "transparent" : "rgba(26,28,44,0.88)",
              textAlign: "center",
              padding: 12,
              pointerEvents: idle ? "none" : "auto",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: CYAN,
                lineHeight: 1.6,
                ...(idle
                  ? {
                      position: "absolute",
                      top: 10,
                      left: 0,
                      right: 0,
                      textShadow: "2px 2px 0 #12131f",
                    }
                  : {}),
              }}
            >
              {idle ? "SNAPIE RUSH" : phase === "win" ? "ALL ROUTES CLEAR" : "GAME OVER"}
            </div>
            {over && lastResult && (
              <div style={{ fontSize: 8, lineHeight: 2 }}>
                SCORE {lastResult.score}
                <br />
                ROUTES CLEARED {lastResult.stagesCleared}
              </div>
            )}
            {idle && (
              <div style={{ fontSize: 7, lineHeight: 2, color: "#a0a3c0" }}>
                LEFT/RIGHT STEER · UP BOOST · DOWN BRAKE
                <br />
                P TO PAUSE · WATCH THE FUEL
              </div>
            )}
            {over && resultSlot && (
              <div style={{ lineHeight: 1.4, fontFamily: "inherit" }}>{resultSlot}</div>
            )}
            <button
              type="button"
              onClick={startRun}
              style={{
                fontFamily: PIXEL_FONT,
                fontSize: 9,
                padding: "10px 14px",
                background: ORANGE,
                color: SHELL,
                border: `2px solid ${LIGHT}`,
                cursor: "pointer",
                pointerEvents: "auto",
              }}
            >
              {idle ? "START" : "RACE AGAIN"}
            </button>
          </div>
        )}
      </div>

      {showMenus && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "8px 10px",
            background: SHELL,
            border: `2px solid ${CYAN}`,
            borderTop: "none",
            fontSize: 7,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            FUEL <Bar value={hud?.fuel ?? 1} color={(hud?.fuel ?? 1) < 0.25 ? ORANGE : CYAN} />
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            SPD <Bar value={hud?.speed ?? 0} color={GREEN} /> x{hud?.speedTier ?? 1}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            ROUTE <Bar value={hud?.progress ?? 0} color={ORANGE} />
          </span>
        </div>
      )}

      {touch && (
        <TouchControls
          fullscreen={isFullscreen}
          dpad={{ left: "left", right: "right" }}
          actions={[{ label: "GAS", code: "accel", primary: true }, { label: "BRK", code: "brake" }]}
          press={(c) => hold(c as "left" | "right" | "accel" | "brake", true)}
          release={(c) => hold(c as "left" | "right" | "accel" | "brake", false)}
        />
      )}
    </div>
  );
});
