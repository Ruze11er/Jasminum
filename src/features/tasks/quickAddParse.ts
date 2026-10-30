/** "Buy milk #errands" → title "Buy milk", tags ["errands"]. */
export function parseQuickAdd(text: string): { title: string; tagNames: string[] } {
  const tagNames: string[] = [];
  const title = text
    .replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_, space: string, tag: string) => {
      tagNames.push(tag);
      return space;
    })
    .replace(/\s+/g, ' ')
    .trim();
  return { title, tagNames };
}
