// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTouchOverlay } from './touchOverlay';

const ptr = (type: string, init: { pointerId: number; clientX?: number; clientY?: number }) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX ?? 0, clientY: init.clientY ?? 0 });
  Object.defineProperty(e, 'pointerId', { value: init.pointerId });
  return e;
};

function setup() {
  const press = vi.fn(), release = vi.fn();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const overlay = createTouchOverlay(host, {
    press, release,
    dpad: { left: 'L', right: 'R', up: 'U', down: 'D' },
    actions: [{ label: 'JUMP', code: 'Space', alsoPress: ['Enter'], primary: true }, { label: 'SWAP', code: 'K' }],
    system: [{ label: 'II', code: 'P' }],
  });
  const btn = (code: string) => host.querySelector<HTMLButtonElement>(`button[aria-label="${code}"]`)!;
  // 100x100 pad at (0,0): centre is (50,50).
  const pad = host.querySelector<HTMLElement>('[data-touch="dpad"]')!;
  pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON() {} });
  return { press, release, host, overlay, btn, pad };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('touchOverlay', () => {
  it('holds a button and its extra codes only while pressed', () => {
    const { press, release, btn } = setup();
    btn('Space').dispatchEvent(ptr('pointerdown', { pointerId: 1 }));
    expect(press).toHaveBeenCalledWith('Space');
    expect(press).toHaveBeenCalledWith('Enter');
    btn('Space').dispatchEvent(ptr('pointerup', { pointerId: 1 }));
    expect(release).toHaveBeenCalledWith('Space');
    expect(release).toHaveBeenCalledWith('Enter');
  });

  it('supports two thumbs at once (D-pad + button)', () => {
    const { press, release, btn, pad } = setup();
    pad.dispatchEvent(ptr('pointerdown', { pointerId: 1, clientX: 95, clientY: 50 }));
    btn('K').dispatchEvent(ptr('pointerdown', { pointerId: 2 }));
    expect(press).toHaveBeenCalledWith('R');
    expect(press).toHaveBeenCalledWith('K');
    btn('K').dispatchEvent(ptr('pointerup', { pointerId: 2 }));
    expect(release).toHaveBeenCalledWith('K');
    expect(release).not.toHaveBeenCalledWith('R');
  });

  it('D-pad slides between directions and releases on lift', () => {
    const { press, release, pad } = setup();
    pad.dispatchEvent(ptr('pointerdown', { pointerId: 1, clientX: 95, clientY: 50 }));
    pad.dispatchEvent(ptr('pointermove', { pointerId: 1, clientX: 5, clientY: 50 }));
    expect(release).toHaveBeenCalledWith('R');
    expect(press).toHaveBeenCalledWith('L');
    pad.dispatchEvent(ptr('pointermove', { pointerId: 1, clientX: 95, clientY: 5 })); // diagonal
    expect(press).toHaveBeenCalledWith('U');
    pad.dispatchEvent(ptr('pointerup', { pointerId: 1 }));
    expect(release).toHaveBeenCalledWith('U');
    expect(release.mock.calls.filter(([c]) => c === 'R').length).toBe(2); // slid off, then lifted
  });

  it('ignores the centre deadzone', () => {
    const { press, pad } = setup();
    pad.dispatchEvent(ptr('pointerdown', { pointerId: 1, clientX: 52, clientY: 52 }));
    expect(press).not.toHaveBeenCalled();
  });

  it('releases held inputs when the layout mode changes, and on destroy', () => {
    const { release, btn, overlay, host } = setup();
    btn('K').dispatchEvent(ptr('pointerdown', { pointerId: 1 }));
    overlay.setMode('overlay');
    expect(release).toHaveBeenCalledWith('K');
    expect(overlay.el.style.position).toBe('fixed');
    // Regression: invalid safe-area CSS was silently dropped, stacking every control top-left.
    const [left, right] = Array.from(overlay.el.children) as HTMLElement[];
    expect(left.style.bottom).toContain('safe-area-inset-bottom');
    expect(left.style.left).toContain('safe-area-inset-left');
    expect(right.style.bottom).toContain('safe-area-inset-bottom');
    expect(right.style.right).toContain('safe-area-inset-right');
    overlay.setMode('bar');
    expect(overlay.el.style.position).not.toBe('fixed');
    overlay.destroy();
    expect(host.children.length).toBe(0);
  });
});
