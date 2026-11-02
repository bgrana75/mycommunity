'use client';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Game,
  MAIN_STAGE_COUNT,
  SECRET_UNLOCK_SCORE,
  VIEW_H,
  VIEW_W,
  type Hud,
  type InputKey,
  type Power,
} from "./game/engine";
import { LEVELS } from "./game/levels";
import Image from "next/image";
import { useFullscreen, usePortraitOrientation } from "@/hooks/useFullscreen";
import { TouchControls } from "../shared/TouchControls";
import { useWakeLock } from "@/hooks/useWakeLock";
import snapieVictory from "./assets/snapie-victory.png";
import type {
  PuffQuestControls,
  PuffQuestOptions,
  PuffQuestPhase,
  PuffQuestResult,
} from "./types";

const KEY_MAP: Record<string, InputKey> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  Space: "jump",
  KeyZ: "jump",
  KeyJ: "jump",
  KeyX: "action",
  KeyK: "action",
  ShiftLeft: "action",
};

const POWER_LABEL: Record<Power, string> = {
  none: "NO POWER",
  star: "SPIT STAR · X TO FIRE",
  hover: "JET HOVER · X TO FLY",
  fire: "FIRE BREATH · X TO BURN",
  spike: "SPIKE DASH · X TO CHARGE",
};

const INK = "#1a1c2c";
const PAPER = "#f4f4f4";
const ORANGE = "#ef7d57";
const GREEN = "#38b764";
const RED = "#b13e53";
const SECRET_UNLOCK_KEY = "snapie-quest:null-garden";

const font = `"Press Start 2P", ui-monospace, SFMono-Regular, Menlo, monospace`;

const S = {
  root: { width: "100%", fontFamily: font, color: PAPER } as CSSProperties,
  frame: {
    position: "relative",
    overflow: "hidden",
    background: INK,
    border: `4px solid ${INK}`,
    boxShadow: `0 0 0 4px ${PAPER}20`,
    borderRadius: 4,
  } as CSSProperties,
  canvas: {
    display: "block",
    width: "100%",
    margin: "0 auto",
    imageRendering: "pixelated",
    aspectRatio: `${VIEW_W} / ${VIEW_H}`,
  } as CSSProperties,
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    // "safe center" falls back to start-alignment once content overflows,
    // so buttons (e.g. Save Score) stay reachable via scroll instead of
    // being clipped off the top/bottom by the frame's fixed aspect ratio
    // on short mobile viewports (plain "center" would clip the overflow
    // above the fold with no way to scroll up to it).
    justifyContent: "safe center",
    gap: 12,
    padding: 16,
    textAlign: "center",
    background: "rgba(26,28,44,0.92)",
    overflowY: "auto",
  } as CSSProperties,
  btn: {
    fontFamily: font,
    fontSize: 10,
    lineHeight: 1.6,
    padding: "8px 12px",
    color: PAPER,
    background: "transparent",
    border: `2px solid ${PAPER}`,
    borderRadius: 2,
    cursor: "pointer",
  } as CSSProperties,
  btnPrimary: {
    color: INK,
    background: ORANGE,
    borderColor: ORANGE,
  } as CSSProperties,
  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    padding: 8,
    fontSize: 9,
    pointerEvents: "none",
  } as CSSProperties,
};

export type PuffQuestProps = PuffQuestOptions & {
  className?: string;
  style?: CSSProperties;
  /** Extra buttons on the title screen (e.g. a leaderboard link). */
  menuSlot?: ReactNode;
  /** Extra content on the game over / win screen (e.g. score submission). */
  resultSlot?: ReactNode;
};

export const PuffQuest = forwardRef<PuffQuestControls, PuffQuestProps>(function PuffQuest(
  {
    playerName,
    sessionId,
    startStage = 1,
    autoStart = false,
    showMenus = true,
    showTouchControls = "auto",
    keyboard = true,
    maxWidth = 900,
    onEvent,
    onResult,
    className,
    style,
    menuSlot,
    resultSlot,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const runRef = useRef({ stage: 0, score: 0, hearts: 3, startedAt: 0, cleared: 0 });
  const emit = useRef(onEvent);
  const emitResult = useRef(onResult);
  emit.current = onEvent;
  emitResult.current = onResult;

  const [phase, setPhase] = useState<PuffQuestPhase>("title");
  const [hud, setHud] = useState<Hud>({
    hearts: 3,
    score: 0,
    stage: startStage,
    stageName: LEVELS[startStage - 1]?.name ?? LEVELS[0]!.name,
    power: "none",
    mouthful: false,
  });
  const [finalScore, setFinalScore] = useState(0);
  const [finalStage, setFinalStage] = useState(startStage);
  const [secretUnlocked, setSecretUnlocked] = useState(false);
  const [muted, setMuted] = useState(false);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const hudRef = useRef(hud);
  hudRef.current = hud;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const buildResult = useCallback(
    (stage: number, score: number, won: boolean): PuffQuestResult => ({
      sessionId,
      playerName,
      score,
      stage,
      stagesCleared: runRef.current.cleared,
      won,
      durationMs: runRef.current.startedAt ? Date.now() - runRef.current.startedAt : 0,
      endedAt: Date.now(),
    }),
    [sessionId, playerName],
  );

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    setMuted(next);
    if (gameRef.current) gameRef.current.sfx.muted = next;
  }, []);

  const ensureGame = useCallback(() => {
    if (gameRef.current || !canvasRef.current) return gameRef.current;
    gameRef.current = new Game(canvasRef.current, {
      onHud: (h) => {
        setHud(h);
        emit.current?.({ type: "hud", hud: h });
      },
      onStageClear: (stage, score) => {
        if (stage === MAIN_STAGE_COUNT && score >= SECRET_UNLOCK_SCORE) {
          window.localStorage.setItem(SECRET_UNLOCK_KEY, "unlocked");
          setSecretUnlocked(true);
        }
        runRef.current = { ...runRef.current, stage, score, hearts: gameRef.current?.remainingHearts ?? 3, cleared: stage };
        setFinalScore(score);
        setPhase("stageclear");
        emit.current?.({ type: "stage-clear", stage, score });
      },
      onGameOver: (stage, score) => {
        const result = buildResult(stage, score, false);
        setFinalStage(stage);
        setFinalScore(score);
        setPhase("gameover");
        emit.current?.({ type: "game-over", result });
        emitResult.current?.(result);
      },
      onWin: (stage, score) => {
        runRef.current.cleared = stage;
        const result = buildResult(stage, score, true);
        setFinalStage(stage);
        setFinalScore(score);
        setPhase("win");
        emit.current?.({ type: "win", result });
        emitResult.current?.(result);
      },
    });
    gameRef.current.sfx.muted = mutedRef.current;
    return gameRef.current;
  }, [buildResult]);

  const startRun = useCallback(
    (from = startStage) => {
      const hasSavedSecret = window.localStorage.getItem(SECRET_UNLOCK_KEY) === "unlocked";
      const maxStage = secretUnlocked || hasSavedSecret ? LEVELS.length : MAIN_STAGE_COUNT;
      const index = Math.min(Math.max(1, from), maxStage) - 1;
      runRef.current = { stage: index, score: 0, hearts: 3, startedAt: Date.now(), cleared: index };
      setPhase("playing");
      emit.current?.({ type: "run-start", sessionId, startStage: index + 1 });
      requestAnimationFrame(() => ensureGame()?.startStage(index, 0, 3));
    },
    [ensureGame, secretUnlocked, sessionId, startStage],
  );

  const nextStage = useCallback(() => {
    const { stage, score, hearts } = runRef.current;
    setPhase("playing");
    requestAnimationFrame(() => ensureGame()?.startStage(stage, score, Math.min(3, hearts + 1)));
  }, [ensureGame]);

  useImperativeHandle(
    ref,
    (): PuffQuestControls => ({
      start: (from) => startRun(from ?? startStage),
      pause: () => gameRef.current?.pause(),
      resume: () => {
        if (phaseRef.current === "playing") gameRef.current?.resume();
      },
      reset: () => {
        gameRef.current?.pause();
        setPhase("title");
      },
      getPhase: () => phaseRef.current,
      getHud: () => hudRef.current,
    }),
    [startRun, startStage],
  );

  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const { isFullscreen, supported: fullscreenSupported, toggle: toggleFullscreen } = useFullscreen(rootRef);
  const isPortrait = usePortraitOrientation();
  useWakeLock(phase === "playing");

  useEffect(() => {
    setSecretUnlocked(window.localStorage.getItem(SECRET_UNLOCK_KEY) === "unlocked");
    emit.current?.({ type: "ready" });
    if (autoStart) startRun(startStage);
    return () => {
      gameRef.current?.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const mapped = KEY_MAP[e.code];
      if (!mapped) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      gameRef.current?.setKey(mapped, down);
    };
    const dn = (e: KeyboardEvent) => onKey(e, true);
    const up = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, [keyboard]);

  const rootStyle = useMemo(
    () =>
      isFullscreen
        ? ({
            ...S.root,
            ...style,
            maxWidth: "none",
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100dvh",
            display: "flex",
            flexDirection: "column",
            background: INK,
          } as CSSProperties)
        : ({ ...S.root, maxWidth, marginLeft: "auto", marginRight: "auto", ...style } as CSSProperties),
    [isFullscreen, maxWidth, style],
  );

  // In fullscreen the frame gets a real, independent height from the flex
  // layout (screen height minus the touch-control bar) instead of just
  // shrink-wrapping the canvas, so the fit() effect below can letterbox the
  // canvas within it instead of the canvas overflowing past the bottom of
  // the screen (which was cutting off the game's floor in landscape).
  const frameStyle = useMemo(
    () =>
      isFullscreen
        ? ({ ...S.frame, flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" } as CSSProperties)
        : S.frame,
    [isFullscreen],
  );

  const showOverlay = phase !== "playing" && (showMenus || phase === "stageclear" || phase === "gameover" || phase === "win");

  // Keep the canvas at a whole-number zoom so pixels never land on half pixels
  // (fractional scaling is what made the picture look like it was trembling).
  useEffect(() => {
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    if (!frame || !canvas) return;
    const fit = () => {
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      if (!w || !h) return;
      // Cap by whichever axis is tighter — on phones filling the width is
      // usually right, but in fullscreen landscape the frame's height is
      // the real constraint (screen height minus the touch-control bar),
      // and without this cap the canvas would grow past the bottom of the
      // screen since width alone doesn't know about that limit.
      const rawZoom = Math.min(w / VIEW_W, h / VIEW_H);
      const zoom = rawZoom >= 2 ? Math.floor(rawZoom) : rawZoom;
      canvas.style.width = `${VIEW_W * zoom}px`;
      canvas.style.height = `${VIEW_H * zoom}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={className} style={rootStyle}>
      <div ref={frameRef} style={frameStyle}>
        <canvas ref={canvasRef} width={VIEW_W} height={VIEW_H} style={S.canvas} />

        <div style={{ position: "absolute", top: 6, right: 6, zIndex: 2, display: "flex", gap: 4 }}>
          {fullscreenSupported && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              style={{
                fontFamily: font,
                fontSize: 8,
                color: PAPER,
                background: "rgba(26,28,44,0.6)",
                border: `1px solid ${PAPER}`,
                borderRadius: 2,
                padding: "4px 6px",
                cursor: "pointer",
              }}
            >
              {isFullscreen ? "⤡" : "⤢"}
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            style={{
              fontFamily: font,
              fontSize: 8,
              color: muted ? "rgba(244,244,244,0.4)" : PAPER,
              background: "rgba(26,28,44,0.6)",
              border: `1px solid ${muted ? "rgba(244,244,244,0.4)" : PAPER}`,
              borderRadius: 2,
              padding: "4px 6px",
              cursor: "pointer",
            }}
          >
            {muted ? "SFX OFF" : "SFX ON"}
          </button>
        </div>

        {isFullscreen && isPortrait && isTouch && (
          // A non-blocking nudge, not a takeover — some phones ignore the
          // landscape lock request (iOS never implements it) or the user has
          // rotation lock on, but the game is still fully playable in
          // portrait, so this shouldn't stop them from tapping through it.
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 3,
              pointerEvents: "none",
              textAlign: "center",
              padding: "6px 8px",
              fontSize: 8,
              lineHeight: 1.6,
              color: PAPER,
              background: "rgba(26,28,44,0.85)",
            }}
          >
            ROTATE YOUR DEVICE FOR THE FULL EXPERIENCE
          </div>
        )}

        {phase === "playing" && (
          <div style={S.hud}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2].map((i) => (
                  <Heart key={i} filled={i < hud.hearts} />
                ))}
              </div>
              <span style={{ color: ORANGE }}>
                {hud.power !== "none" ? POWER_LABEL[hud.power] : hud.mouthful ? "MOUTHFUL! ↓ SWALLOW" : "NO POWER"}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <div>{String(hud.score).padStart(6, "0")}</div>
              <div style={{ color: GREEN }}>
                 {hud.stage}-{hud.stage > MAIN_STAGE_COUNT ? LEVELS.length : MAIN_STAGE_COUNT} {hud.stageName}
              </div>
            </div>
          </div>
        )}

        {showOverlay && (
          <div style={S.overlay}>
            {phase === "title" && (
              <>
                <h2 style={{ fontSize: 18, color: GREEN, margin: 0 }}>SNAPIE QUEST</h2>
                <p style={{ fontSize: 9, lineHeight: 1.8, maxWidth: 340 }}>
                   INHALE ENEMIES. STEAL THEIR POWERS. CLEAR {MAIN_STAGE_COUNT} STAGES.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => startRun(startStage)}>
                    START
                  </button>
                   {secretUnlocked && (
                     <button style={S.btn} onClick={() => startRun(LEVELS.length)}>
                       ???
                     </button>
                   )}
                  <button style={S.btn} onClick={() => setPhase("howto")}>
                    HOW TO PLAY
                  </button>
                  {menuSlot}
                </div>
              </>
            )}

            {phase === "howto" && (
              <div style={{ fontSize: 8, lineHeight: 2, textAlign: "left", maxWidth: 420 }}>
                <h2 style={{ fontSize: 12, color: GREEN, textAlign: "center" }}>HOW TO PLAY</h2>
                <p>← → / A D — WALK</p>
                <p>SPACE / Z — JUMP. TAP AGAIN IN AIR TO FLOAT.</p>
                <p>X — HOLD TO INHALE A NEARBY ENEMY.</p>
                <p>X WITH A MOUTHFUL — SPIT IT OUT AS A STAR.</p>
                <p>↓ WITH A MOUTHFUL — SWALLOW AND COPY ITS POWER.</p>
                <p>X WITH A POWER — USE IT. ↓ DROPS IT.</p>
                <p style={{ color: ORANGE }}>
                  WALKER → SPIT STAR · FLYER → HOVER · FIRE BLOB → FIRE BREATH · SPIKER → SPIKE DASH
                </p>
                <p>REACH THE GLOWING BIONIC LILY TO CLEAR THE STAGE.</p>
                <div style={{ textAlign: "center", paddingTop: 8 }}>
                  <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => setPhase("title")}>
                    BACK
                  </button>
                </div>
              </div>
            )}

            {phase === "stageclear" && (
              <>
                {/* unoptimized: pre-rendered sprite imported for the hashed
                    URL — resizes would be wasted optimizer cost for a 120px
                    celebration screen in a mini-game. */}
                <Image
                  src={snapieVictory}
                  alt="Snapie celebrating"
                  width={120}
                  height={120}
                  unoptimized
                  style={{ width: 120, height: 120, imageRendering: "pixelated" }}
                />
                 <h2 style={{ fontSize: 14, color: ORANGE, margin: 0 }}>
                   {runRef.current.stage === MAIN_STAGE_COUNT ? "SECRET PATH OPEN!" : "STAGE CLEAR!"}
                 </h2>
                <p style={{ fontSize: 10 }}>SCORE {finalScore}</p>
                 <p style={{ fontSize: 9, color: GREEN }}>
                   NEXT: {LEVELS[runRef.current.stage]?.name}
                 </p>
                <button style={{ ...S.btn, ...S.btnPrimary }} onClick={nextStage}>
                  CONTINUE
                </button>
              </>
            )}

            {(phase === "gameover" || phase === "win") && (
              <>
                <h2 style={{ fontSize: 14, color: phase === "win" ? ORANGE : RED }}>
                   {phase === "win"
                     ? finalStage > MAIN_STAGE_COUNT
                       ? "THE NULL GARDEN FALLS!"
                       : "YOU BEAT THE KEEP!"
                     : "GAME OVER"}
                </h2>
                <p style={{ fontSize: 10 }}>
                  FINAL SCORE {finalScore} · STAGE {finalStage}
                </p>
                {resultSlot}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  <button style={S.btn} onClick={() => startRun(startStage)}>
                    PLAY AGAIN
                  </button>
                  {menuSlot}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {(showTouchControls === true || (showTouchControls === "auto" && isTouch)) && (
        <TouchControls
          fullscreen={isFullscreen}
          dpad={{ left: "left", right: "right", down: "down" }}
          actions={[{ label: "X", code: "action", primary: true }, { label: "JUMP", code: "jump", primary: true }]}
          press={(c) => gameRef.current?.setKey(c as InputKey, true)}
          release={(c) => gameRef.current?.setKey(c as InputKey, false)}
        />
      )}
    </div>
  );
});

function Heart({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        backgroundColor: filled ? RED : "rgba(244,244,244,0.2)",
        clipPath: "polygon(30% 0, 50% 20%, 70% 0, 100% 30%, 50% 100%, 0 30%)",
      }}
    />
  );
}
