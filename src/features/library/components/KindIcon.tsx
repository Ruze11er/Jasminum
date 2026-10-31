import {
  BookOpen,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import { chipColorClasses, type ChipColor } from '@/design-system/components/chipColors';
import type { DocumentKind } from '@/data/types';
import { cn } from '@/lib/cn';

const KINDS: Record<DocumentKind, { icon: LucideIcon; color: ChipColor }> = {
  pdf: { icon: FileText, color: 'pink' },
  word: { icon: FileType, color: 'sky' },
  slides: { icon: Presentation, color: 'peach' },
  ebook: { icon: BookOpen, color: 'lavender' },
  image: { icon: FileImage, color: 'mint' },
  text: { icon: ScrollText, color: 'butter' },
  sheet: { icon: FileSpreadsheet, color: 'mint' },
  other: { icon: File, color: 'neutral' },
};

/** A colored square with the file type's icon. Decorative: the type is also written out. */
export function KindIcon({ kind, className }: { kind: DocumentKind; className?: string }) {
  const { icon: Icon, color } = KINDS[kind];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl [&>svg]:size-5',
        chipColorClasses[color],
        className,
      )}
    >
      <Icon />
    </span>
  );
}
