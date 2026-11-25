import { useEffect, useRef } from 'react';

/**
 * Touch swipe on an element: left / right / down callbacks.
 * A swipe swallows the click that follows, so swiping the mini player doesn't open it.
 */
export function useSwipe(ref, handlers, min = 60) {
  const h = useRef(handlers);
  h.current = handlers;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let s = null;
    let swallow = false;
    const start = (e) => { if (e.pointerType === 'mouse') return; s = { x: e.clientX, y: e.clientY, t: Date.now() }; };
    const end = (e) => {
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y, dt = Date.now() - s.t;
      s = null;
      if (dt > 800) return;
      if (Math.abs(dx) > min && Math.abs(dx) > Math.abs(dy) * 1.4) { swallow = true; (dx < 0 ? h.current.left : h.current.right)?.(); }
      else if (h.current.down && dy > min * 1.4 && dy > Math.abs(dx) * 1.4) { swallow = true; h.current.down(); }
    };
    const click = (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); swallow = false; } };
    const cancel = () => { s = null; };
    el.addEventListener('pointerdown', start, { passive: true });
    el.addEventListener('pointerup', end, { passive: true });
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', start); el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', cancel); el.removeEventListener('click', click, true);
    };
  }, [ref, min]);
}
