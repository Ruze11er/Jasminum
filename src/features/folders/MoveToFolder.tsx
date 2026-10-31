import { Select } from '@/design-system';
import type { Folder } from '@/data/types';

const NO_FOLDER = '__none';

/** "Move to…" for a selection: picks a folder (or none) and moves the selected items there. */
export function MoveToFolder({
  folders,
  disabled,
  onMove,
}: {
  folders: Folder[];
  disabled?: boolean;
  onMove: (folder: Folder | null) => void;
}) {
  return (
    <Select
      aria-label="Move to folder"
      value=""
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        if (v) onMove(v === NO_FOLDER ? null : (folders.find((f) => f.id === v) ?? null));
      }}
      className="w-36 [&>select]:h-9 [&>select]:bg-surface [&>select]:text-sm max-md:[&>select]:h-11"
    >
      <option value="" disabled>
        Move to…
      </option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
      <option value={NO_FOLDER}>No folder</option>
    </Select>
  );
}
