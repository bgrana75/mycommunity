import { Game } from "./game/game";
import { audio } from "./game/audio";
import { WEAP } from "./game/entities";
import { createTouchOverlay, type TouchOverlayHandle } from "../shared/touchOverlay";
import {
  GAME_ID, GAME_VERSION,
  type SnapieEvent, type SnapieHud, type SnapieMountHandle, type SnapieOptions, type SnapiePhase, type SnapieResult,
} from "./types";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Mount the game into any DOM element. Returns imperative controls + destroy(). */
export function mountSnapieInfoWar(element: HTMLElement, options: SnapieOptions = {}): SnapieMountHandle {
  const playerName = (options.playerName || "PLAYER").slice(0, 24);
  const sessionId = options.sessionId || newId();
  const showMenus = options.showMenus !== false;
  const startStage = Math.min(5, Math.max(1, Math.floor(options.startStage || 1))) - 1;
  const touch = options.showTouchControls ?? (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches);
  const inIframe = typeof window !== "undefined" && window.parent !== window;

  // ---- DOM ----
  const root = document.createElement("div");
  root.style.cssText = `position:relative;width:100%;${options.maxWidth ? `max-width:${options.maxWidth}px;` : ""}margin:0 auto;user-select:none;touch-action:none;`;
  const canvas = document.createElement("canvas");
  canvas.width = 384; canvas.height = 216; canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "SNAPIE: INFORMATION WAR game");
  canvas.style.cssText = "display:block;width:100%;height:auto;aspect-ratio:384/216;image-rendering:pixelated;background:#05000a;outline:none;";
  root.appendChild(canvas);
  element.appendChild(root);

  const game = new Game(canvas, options.keyboard !== false);
  game.menus = showMenus;

  // ---- touch controls ----
  // Floating over the screen in fullscreen, a bar under the canvas otherwise.
  let overlay: TouchOverlayHandle | null = null;
  const syncOverlayMode = () => overlay?.setMode(document.fullscreenElement?.contains(root) ? "overlay" : "bar");
  if (touch) {
    overlay = createTouchOverlay(root, {
      press: (c) => game.input.press(c),
      release: (c) => game.input.release(c),
      onTouch: () => audio.init(),
      dpad: { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS" },
      // JUMP/FIRE double as menu confirm, so they also hold Enter.
      actions: [
        { label: "JUMP", code: "Space", alsoPress: ["Enter"], primary: true },
        { label: "FIRE", code: "KeyJ", alsoPress: ["Enter"], primary: true },
        { label: "SWAP", code: "KeyK" },
      ],
      system: [{ label: "II", code: "KeyP" }],
    });
    document.addEventListener("fullscreenchange", syncOverlayMode);
    syncOverlayMode();
  }

  // ---- events ----
  const emit = (event: SnapieEvent) => {
    try { options.onEvent?.(event); } catch (e) { console.error(e); }
    if (inIframe) window.parent.postMessage({ source: "snapie-game", gameId: GAME_ID, event }, "*");
  };
  const phase = (): SnapiePhase => {
    switch (game.state) {
      case "intro": return "intro";
      case "card": return "stage-card";
      case "play": return "playing";
      case "pause": return "paused";
      case "clear": return "stage-clear";
      case "gameover": return "game-over";
      case "ending": return "won";
      default: return "idle";
    }
  };
  const hud = (): SnapieHud => {
    const p = game.player, b = game.boss, w = p.wpn ?? { id: "sting" as const, lvl: 1 };
    return {
      score: game.score, lives: Math.max(0, game.lives), hp: Math.max(0, p.hp), maxHp: p.maxHp,
      weapon: WEAP[w.id].name, weaponLevel: w.lvl, stage: game.world + 1,
      bossHp: b && !b.dead ? b.hp / b.maxHp : null, phase: phase(),
    };
  };
  let runStartAt = 0;
  const result = (won: boolean): SnapieResult => ({
    gameId: GAME_ID, gameVersion: GAME_VERSION, sessionId, playerName, score: game.score,
    stage: game.world + 1, stagesCleared: game.cleared, won,
    durationMs: Math.round(performance.now() - runStartAt), endedAt: Date.now(),
  });
  const finish = (won: boolean) => {
    const r = result(won);
    emit({ type: won ? "win" : "game-over", result: r });
    try { options.onResult?.(r); } catch (e) { console.error(e); }
  };
  game.hooks = {
    runStart: () => { runStartAt = performance.now(); emit({ type: "run-start", sessionId, stage: game.world + 1 }); },
    stageClear: () => emit({ type: "stage-clear", stage: game.world + 1, score: game.score }),
    gameOver: () => finish(false),
    win: () => finish(true),
  };

  // ---- controls ----
  const controls = {
    start() { audio.init(); game.newGame(startStage); if (!showMenus) { game.state = "card"; game.st = 0; } canvas.focus({ preventScroll: true }); },
    pause() { if (game.state === "play") game.state = "pause"; },
    resume() { if (game.state === "pause") game.state = "play"; },
    reset() { game.state = "title"; game.menu = 0; game.st = 0; game.score = 0; },
    getPhase: phase,
    getHud: hud,
  };

  const onMessage = (e: MessageEvent) => {
    const d = e.data as { target?: unknown; command?: unknown } | null;
    if (!d || typeof d !== "object" || d.target !== GAME_ID) return;
    if (d.command === "start" || d.command === "pause" || d.command === "resume" || d.command === "reset") controls[d.command as "start" | "pause" | "resume" | "reset"]();
  };
  window.addEventListener("message", onMessage);
  const unlock = () => audio.init();
  root.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  // ---- loop ----
  let raf = 0, last = performance.now(), acc = 0, lastHud = "";
  const STEP = 1000 / 60;
  const loop = (now: number) => {
    acc = Math.min(acc + (now - last), 200); last = now;
    while (acc >= STEP) {
      game.step(); acc -= STEP;
      if (game.t % 15 === 0 && (game.state === "play" || game.state === "pause")) {
        const h = hud(), k = JSON.stringify(h);
        if (k !== lastHud) { lastHud = k; emit({ type: "hud", hud: h }); }
      }
    }
    game.render();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  emit({ type: "ready", sessionId, playerName });
  if (options.autoStart) controls.start();

  return {
    ...controls,
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("fullscreenchange", syncOverlayMode);
      overlay?.destroy();
      game.input.destroy();
      audio.music(null);
      root.remove();
    },
  };
}
