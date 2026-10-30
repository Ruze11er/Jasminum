import { db } from '@/data/db';
import { searchIndex } from '@/data/search/searchIndex';
import { clock } from '@/lib/clock';

/** Gives each test a fresh, empty database and search index. */
export async function resetDatabase() {
  db.close();
  await db.delete();
  await db.open();
  searchIndex.resetForTests();
  clock.reset();
}
