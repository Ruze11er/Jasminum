import { useLiveQuery } from 'dexie-react-hooks';
import { clock } from '@/lib/clock';
import { z, type Schema } from '@/lib/validation';
import { db } from '../db';

/**
 * Every stored setting, with its validation and default. Add new settings here.
 * Theme is NOT here: it lives in localStorage so it can be applied before first paint.
 */
export const settingDefinitions = {
  profile: {
    schema: z.object({
      displayName: z
        .string()
        .check(z.trim(), z.maxLength(40, 'Keep your name under 40 characters')),
    }),
    defaultValue: { displayName: '' },
  },
  /** When the user last exported a backup (ms), or null if never. Drives backup reminders. */
  lastBackupAt: {
    schema: z.nullable(z.int()),
    defaultValue: null as number | null,
  },
} satisfies Record<string, { schema: Schema; defaultValue: unknown }>;

export type SettingKey = keyof typeof settingDefinitions;
export type SettingValue<K extends SettingKey> = z.output<(typeof settingDefinitions)[K]['schema']>;

/**
 * Reads a setting. Invalid stored values (e.g. from an older version) fall back to the
 * default instead of crashing the app.
 */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await db.settings.get(key);
  return parseOrDefault(key, row?.value);
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: z.input<(typeof settingDefinitions)[K]['schema']>,
): Promise<SettingValue<K>> {
  const parsed = settingDefinitions[key].schema.parse(value) as SettingValue<K>;
  await db.settings.put({ key, value: parsed, updatedAt: clock.now() });
  return parsed;
}

/** Live setting value for components. Returns the default while loading. */
export function useSetting<K extends SettingKey>(key: K): SettingValue<K> {
  return useLiveQuery(
    async () => parseOrDefault(key, (await db.settings.get(key))?.value),
    [key],
    settingDefinitions[key].defaultValue as SettingValue<K>,
  );
}

function parseOrDefault<K extends SettingKey>(key: K, value: unknown): SettingValue<K> {
  const def = settingDefinitions[key];
  if (value === undefined) return def.defaultValue as SettingValue<K>;
  const result = def.schema.safeParse(value);
  return (result.success ? result.data : def.defaultValue) as SettingValue<K>;
}
