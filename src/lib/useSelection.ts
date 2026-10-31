import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface Selection {
  /** Selection mode is on: taps select items instead of opening them. */
  active: boolean;
  /** Selected ids that are still shown, in list order. Bulk actions use these. */
  ids: string[];
  count: number;
  allSelected: boolean;
  isSelected: (id: string) => boolean;
  /** Select or unselect one item (and turn selection mode on). `range` (Shift) also selects
   * everything between it and the last item clicked. */
  toggle: (id: string, range?: boolean) => void;
  selectAll: () => void;
  clear: () => void;
  start: () => void;
  /** Leave selection mode; focus goes back to the Select button. */
  exit: () => void;
  /** Callback ref for the "Select" button, so focus can return to it. */
  bindTrigger: (el: HTMLButtonElement | null) => void;
}

const typing = (el: Element | null) =>
  !!el && (el.matches('input, textarea, select') || (el as HTMLElement).isContentEditable);

/**
 * Multi-select for a list. `visibleIds` are the items on screen, in order: hidden items
 * (filtered out) are never acted on. While active, Esc leaves and Ctrl/Cmd+A selects all.
 */
export function useSelection(visibleIds: string[]): Selection {
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const anchor = useRef<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const refocus = useRef(false);
  const bindTrigger = useCallback((el: HTMLButtonElement | null) => {
    trigger.current = el;
  }, []);

  const key = visibleIds.join('\n');
  // Recomputed only when the visible list really changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const visible = useMemo(() => visibleIds, [key]);
  const ids = useMemo(() => visible.filter((id) => picked.has(id)), [visible, picked]);

  const toggle = useCallback(
    (id: string, range = false) => {
      setActive(true);
      // Read the anchor now: the update below runs later, after it has moved.
      const from = anchor.current ? visible.indexOf(anchor.current) : -1;
      setPicked((prev) => {
        const next = new Set(prev);
        const to = visible.indexOf(id);
        if (range && from >= 0 && to >= 0) {
          const [a, b] = from < to ? [from, to] : [to, from];
          for (const v of visible.slice(a, b + 1)) next.add(v);
        } else if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      anchor.current = id;
    },
    [visible],
  );
  const selectAll = useCallback(() => setPicked(new Set(visible)), [visible]);
  const clear = useCallback(() => setPicked(new Set()), []);
  const start = useCallback(() => setActive(true), []);
  const exit = useCallback(() => {
    setActive(false);
    setPicked(new Set());
    anchor.current = null;
    refocus.current = true;
  }, []);

  // The Select button is back on screen after leaving: give it the focus.
  useEffect(() => {
    if (active || !refocus.current) return;
    refocus.current = false;
    trigger.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      // Dialogs (like "Delete forever?") handle their own keys.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        exit();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'a' &&
        !typing(document.activeElement)
      ) {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, exit, selectAll]);

  return {
    active,
    ids,
    count: ids.length,
    allSelected: visible.length > 0 && ids.length === visible.length,
    isSelected: (id) => picked.has(id),
    toggle,
    selectAll,
    clear,
    start,
    exit,
    bindTrigger,
  };
}
