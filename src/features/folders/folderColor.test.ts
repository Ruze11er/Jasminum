import { describe, expect, it } from 'vitest';
import { FOLDER_COLORS, folderColor } from './folderColor';

describe('folderColor', () => {
  it('uses the picked color', () => {
    expect(folderColor({ color: 'mint', order: 0 })).toBe('mint');
  });

  it('gives neighbouring folders different colors when none is picked', () => {
    const colors = FOLDER_COLORS.map((_, order) => folderColor({ color: null, order }));
    expect(new Set(colors).size).toBe(FOLDER_COLORS.length);
    expect(folderColor({ color: null, order: FOLDER_COLORS.length })).toBe(colors[0]);
  });

  it('ignores colors it does not know', () => {
    expect(folderColor({ color: 'neutral', order: 1 })).toBe(FOLDER_COLORS[1]);
  });
});
