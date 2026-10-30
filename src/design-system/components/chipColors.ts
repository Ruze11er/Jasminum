export type ChipColor = 'pink' | 'lavender' | 'mint' | 'peach' | 'butter' | 'sky' | 'neutral';

export const chipColorClasses: Record<ChipColor, string> = {
  pink: 'bg-primary-soft text-primary-soft-fg',
  lavender: 'bg-lavender/45 text-lavender-fg dark:bg-lavender/20 dark:text-lavender',
  mint: 'bg-mint/50 text-mint-fg dark:bg-mint/15 dark:text-mint',
  peach: 'bg-peach/55 text-peach-fg dark:bg-peach/15 dark:text-peach',
  butter: 'bg-butter/70 text-butter-fg dark:bg-butter/15 dark:text-butter',
  sky: 'bg-sky/50 text-sky-fg dark:bg-sky/15 dark:text-sky',
  neutral: 'bg-surface-muted text-fg-muted',
};

export const chipColors = Object.keys(chipColorClasses) as ChipColor[];
