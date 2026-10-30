import { useState } from 'react';

/**
 * Shows a toggle's new state immediately while the database save runs, so ticking a
 * checkbox never looks ignored. As soon as the saved value differs from the value we
 * toggled from (the save landed, or something else changed it), the optimistic value is
 * dropped, so a later Undo can't resurrect it.
 */
export function useOptimisticFlag(actual: boolean) {
  const [pending, setPending] = useState<{ value: boolean; from: boolean } | null>(null);
  // Resetting state during render is React's recommended way to drop stale derived state.
  if (pending && pending.from !== actual) setPending(null);
  const value = pending && pending.from === actual ? pending.value : actual;

  const toggle = async (save: () => Promise<unknown>) => {
    setPending({ value: !actual, from: actual });
    try {
      await save();
    } catch (err) {
      setPending(null);
      throw err;
    }
  };

  return [value, toggle] as const;
}
