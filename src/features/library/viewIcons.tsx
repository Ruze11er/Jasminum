import type { ReactNode } from 'react';
import { Clock, Files, FolderX, History, Star, TagIcon } from 'lucide-react';
import type { LibraryView } from './selectors';

/** Icons for the library's views, in the side list and the chips. */
export const VIEW_ICONS: Partial<Record<LibraryView, ReactNode>> = {
  all: <Files />,
  recent: <Clock />,
  opened: <History />,
  favorites: <Star />,
  unfiled: <FolderX />,
  untagged: <TagIcon />,
};
