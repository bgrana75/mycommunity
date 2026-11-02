# Games on mobile — the standard

Every Snapie game must be playable on a phone. This is the contract; `components/games/shared/touchOverlay.ts` implements it, and new games should use it instead of rolling their own buttons.

## Rules

1. **Fullscreen fits the screen.** The fullscreen root is `position: fixed; inset: 0; height: 100dvh` (never `100vh`, never `minHeight`). The canvas is letterboxed to the largest box of its aspect ratio that fits (`min(100vw, calc(100dvh * W / H))`). If the canvas can be taller than the screen, controls will be pushed off it — that was the Info War bug.
2. **Fullscreen controls float over the game**, translucent (~60% opacity, brighter when pressed), in the bottom corners where thumbs rest: movement on the left, actions on the right, pause stacked with the small buttons (never top-left, where HUDs live). No fixed control bar eating play area.
3. **Inline (not fullscreen) controls sit in a bar below the canvas**, so a small portrait canvas isn't covered by its own buttons.
4. **Safe areas.** Pad with `env(safe-area-inset-*)` so the notch and home indicator never cover a control (`viewportFit: 'cover'` is already set in `app/layout.tsx`).
5. **Touch targets are at least 44px.** Primary actions are bigger (76px).
6. **Pointer Events, one pointer per control.** Use `pointerdown/up/cancel` with pointer capture and `touch-action: none` — never `touchstart`. Two thumbs must work together (move + jump). Release everything on cancel, layout change and destroy so no input sticks.
7. **Landscape.** `useFullscreen` locks landscape where supported (Android); iOS can't, so show the portrait "rotate" nudge and keep the game playable.
8. **Audio unlock on first touch**, and **wake lock** while playing (`useWakeLock`).
9. **Don't hijack the page.** Only the game surface sets `touch-action: none`; scrolling must work everywhere else.

## Using the shared overlay

```ts
import { createTouchOverlay } from "../shared/touchOverlay";

const overlay = createTouchOverlay(rootEl, {
  press: (code) => input.press(code),
  release: (code) => input.release(code),
  dpad: { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS" },
  actions: [{ label: "JUMP", code: "Space", primary: true }, { label: "SWAP", code: "KeyK" }],
  system: [{ label: "II", code: "KeyP" }],
});
// on fullscreenchange:
overlay.setMode(document.fullscreenElement?.contains(rootEl) ? "overlay" : "bar");
```

React games use the wrapper instead — render it inside the game's fullscreen root where the old control bar was:

```tsx
import { TouchControls } from "../shared/TouchControls";

<TouchControls
  fullscreen={isFullscreen}
  dpad={{ left: "left", right: "right" }}          // only the directions the game uses
  actions={[{ label: "GAS", code: "accel", primary: true }, { label: "BRK", code: "brake" }]}
  press={(code) => hold(code, true)}
  release={(code) => hold(code, false)}
/>
```

If the game's board fills the screen (a tall board in portrait), pass `fullscreen={isFullscreen && !isPortrait}` so the controls stay in a bar and don't cover the play area. Blocks does this.

Reference integrations: Info War (`snapie-info-war/mount.ts`, vanilla DOM), Rush (`SnapieRush.tsx`), Blocks (`SnapieBlocks.tsx`).

## Status

| Game | Fullscreen fits | Touch controls |
| --- | --- | --- |
| Info War, Rush, Puff Quest, Blocks | yes | shared overlay (floating in fullscreen, bar inline) |
| Blast | yes | n/a (tap the aliens) |
| Jump | yes | n/a (drag anywhere to steer) |

Test every game change with the mobile checklist in [qa.md](./qa.md).
