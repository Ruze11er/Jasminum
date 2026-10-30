import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Category, ChecklistItem, Tag, Task } from '@/data/types';

export interface TasksData {
  tasks: Task[];
  categories: Category[];
  tags: Tag[];
  categoryById: Map<string, Category>;
  tagById: Map<string, Tag>;
  checklistByTask: Map<string, ChecklistItem[]>;
}

/**
 * Everything the task screens need, kept live: any change in the database re-renders.
 * Loads all non-deleted tasks, which is fine for a personal organizer (thousands of rows).
 */
export function useTasksData(): TasksData | undefined {
  return useLiveQuery(async () => {
    const [tasks, categories, tags, items] = await Promise.all([
      db.tasks.filter((t) => !t.deletedAt).toArray(),
      db.categories
        .orderBy('order')
        .filter((c) => !c.deletedAt)
        .toArray(),
      db.tags
        .orderBy('normalizedName')
        .filter((t) => !t.deletedAt)
        .toArray(),
      db.checklistItems.toArray(),
    ]);
    const checklistByTask = new Map<string, ChecklistItem[]>();
    for (const item of items.sort((a, b) => a.order - b.order)) {
      const list = checklistByTask.get(item.taskId);
      if (list) list.push(item);
      else checklistByTask.set(item.taskId, [item]);
    }
    return {
      tasks,
      categories,
      tags,
      categoryById: new Map(categories.map((c) => [c.id, c])),
      tagById: new Map(tags.map((t) => [t.id, t])),
      checklistByTask,
    };
  }, []);
}
