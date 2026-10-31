import { useState, type DragEvent } from 'react';

/**
 * Makes an element a drop target for one kind of dragged item (a file card, a note card).
 * `over` is true while such an item is held above it, for highlighting.
 */
export function useItemDrop(type: string, onDropId: (id: string) => void) {
  const [over, setOver] = useState(false);
  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(type);
  return {
    over,
    dropProps: {
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: (e: DragEvent<HTMLElement>) => {
        // Moving onto a child also fires dragleave; only clear when really leaving.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        if (!accepts(e)) return;
        e.preventDefault();
        setOver(false);
        onDropId(e.dataTransfer.getData(type));
      },
    },
  };
}

/** Props for a draggable card: puts its id on the drag under `type`. */
export const dragSource = (type: string, id: string) => ({
  onDragStart: (e: DragEvent) => {
    e.dataTransfer.setData(type, id);
    e.dataTransfer.effectAllowed = 'move';
  },
});
