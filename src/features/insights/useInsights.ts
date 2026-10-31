import { useLiveQuery } from 'dexie-react-hooks';
import { insightsRepo } from '@/data/repos/insights';
import type { Insight } from '@/data/types';

/** Active insights, most important first (kept fresh by the runner). */
export function useActiveInsights(): Insight[] | undefined {
  return useLiveQuery(() => insightsRepo.active(), []);
}
