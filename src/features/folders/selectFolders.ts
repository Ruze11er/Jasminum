/** Lower-case and strip accents, so "biologia" finds "Biología". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

/** Folders whose name contains every word of the search. */
export function selectFolders<F extends { name: string }>(folders: F[], text: string): F[] {
  const words = fold(text).split(/\s+/).filter(Boolean);
  if (!words.length) return folders;
  return folders.filter((f) => words.every((w) => fold(f.name).includes(w)));
}
