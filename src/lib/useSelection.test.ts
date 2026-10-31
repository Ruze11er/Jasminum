import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSelection } from './useSelection';

const ids = ['a', 'b', 'c', 'd', 'e'];

describe('useSelection', () => {
  it('toggles items and turns selection mode on', () => {
    const { result } = renderHook(() => useSelection(ids));
    expect(result.current.active).toBe(false);
    act(() => result.current.toggle('b'));
    act(() => result.current.toggle('d'));
    expect(result.current.active).toBe(true);
    expect(result.current.ids).toEqual(['b', 'd']);
    act(() => result.current.toggle('b'));
    expect(result.current.ids).toEqual(['d']);
  });

  it('selects a range with Shift, in either direction', () => {
    const { result } = renderHook(() => useSelection(ids));
    act(() => result.current.toggle('d'));
    act(() => result.current.toggle('b', true));
    expect(result.current.ids).toEqual(['b', 'c', 'd']);
  });

  it('selects all and none', () => {
    const { result } = renderHook(() => useSelection(ids));
    act(() => result.current.start());
    act(() => result.current.selectAll());
    expect(result.current.allSelected).toBe(true);
    expect(result.current.count).toBe(5);
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
    expect(result.current.active).toBe(true);
  });

  it('only acts on items still shown', () => {
    const { result, rerender } = renderHook(({ list }) => useSelection(list), {
      initialProps: { list: ids },
    });
    act(() => result.current.selectAll());
    rerender({ list: ['a', 'c'] });
    expect(result.current.ids).toEqual(['a', 'c']);
    expect(result.current.allSelected).toBe(true);
  });

  it('Escape leaves selection mode and Ctrl+A selects all', () => {
    const { result } = renderHook(() => useSelection(ids));
    act(() => result.current.start());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));
    });
    expect(result.current.count).toBe(5);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.active).toBe(false);
    expect(result.current.count).toBe(0);
  });
});
