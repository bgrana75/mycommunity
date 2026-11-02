// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { TouchControls } from './TouchControls';

afterEach(cleanup);

const props = (press = vi.fn(), release = vi.fn()) => ({
  dpad: { left: 'left' }, actions: [{ label: 'GO', code: 'go', primary: true }], press, release,
});

describe('TouchControls', () => {
  it('floats over the screen only while fullscreen', () => {
    const { container, rerender } = render(createElement(TouchControls, { ...props(), fullscreen: false }));
    const overlay = () => container.firstElementChild!.firstElementChild as HTMLElement;
    expect(overlay().style.position).not.toBe('fixed');
    rerender(createElement(TouchControls, { ...props(), fullscreen: true }));
    expect(overlay().style.position).toBe('fixed');
  });

  it('calls the latest press/release, not the first render\'s', () => {
    const first = vi.fn(), second = vi.fn();
    const { container, rerender } = render(createElement(TouchControls, { ...props(first), fullscreen: false }));
    rerender(createElement(TouchControls, { ...props(second), fullscreen: false }));
    const btn = container.querySelector('button')!;
    const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true });
    Object.defineProperty(down, 'pointerId', { value: 1 });
    btn.dispatchEvent(down);
    expect(second).toHaveBeenCalledWith('go');
    expect(first).not.toHaveBeenCalled();
  });

  it('removes the overlay on unmount', () => {
    const { container, unmount } = render(createElement(TouchControls, { ...props(), fullscreen: false }));
    const host = container.firstElementChild!;
    unmount();
    expect(host.children.length).toBe(0);
  });
});
