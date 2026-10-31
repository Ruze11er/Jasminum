import type { ChipColor } from '@/design-system/components/chipColors';
import type { Folder } from '@/data/types';

/** The colors a folder can have, in the order new folders get them. */
export const FOLDER_COLORS = ['sky', 'peach', 'lavender', 'mint', 'butter', 'pink'] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];

export const FOLDER_COLOR_LABELS: Record<FolderColor, string> = {
  sky: 'Blue',
  peach: 'Peach',
  lavender: 'Lavender',
  mint: 'Green',
  butter: 'Yellow',
  pink: 'Pink',
};

const isFolderColor = (c: string | null): c is FolderColor =>
  (FOLDER_COLORS as readonly string[]).includes(c ?? '');

/**
 * A folder's color: the one the user picked, or one from its position, so side-by-side
 * folders differ even before anyone picks a color.
 */
export function folderColor(folder: Pick<Folder, 'color' | 'order'>): ChipColor {
  if (isFolderColor(folder.color)) return folder.color;
  const i = Math.abs(Math.trunc(folder.order)) % FOLDER_COLORS.length;
  return FOLDER_COLORS[i]!;
}
