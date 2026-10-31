import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Horizontal swipe on touch screens (e.g. swipe a task right to complete it, left to
 * delete it). Only touch is handled, so a mouse never drags rows by accident. Vertical
 * movement is left to the browser for scrolling: as soon as a gesture looks vertical,
 * it's ignored. Buttons and checkboxes in the row remain the accessible way to act.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}) {
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const axis = useRef<'x' | 'y' | null>(null);
  /** True right after a swipe, so the click that follows doesn't also open the row. */
  const justSwiped = useRef(false);

  const end = () => {
    start.current = null;
    axis.current = null;
    setOffset(0);
  };

  const handlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      axis.current = null;
      justSwiped.current = false;
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = start.current;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      if (!axis.current) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axis.current !== 'x') return;
      // Only allow directions that do something; resist a little past the threshold.
      const allowed = (dx > 0 && onSwipeRight) || (dx < 0 && onSwipeLeft) ? dx : 0;
      const resisted =
        Math.abs(allowed) > threshold
          ? Math.sign(allowed) * (threshold + (Math.abs(allowed) - threshold) * 0.3)
          : allowed;
      setOffset(resisted);
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const s = start.current;
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x;
      if (axis.current === 'x' && Math.abs(dx) >= threshold) {
        justSwiped.current = true;
        if (dx > 0) onSwipeRight?.();
        else onSwipeLeft?.();
      }
      end();
    },
    onPointerCancel: end,
    onClickCapture: (e: React.MouseEvent) => {
      if (justSwiped.current) {
        e.preventDefault();
        e.stopPropagation();
        justSwiped.current = false;
      }
    },
  };

  return { offset, handlers, progress: Math.min(1, Math.abs(offset) / threshold) };
}
