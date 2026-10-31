// Sums the gzipped size of the JavaScript the app downloads at startup: the entry script
// plus every chunk index.html preloads. Run after `npm run build`.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 200;
const html = readFileSync('dist/index.html', 'utf8');
const files = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
let total = 0;
for (const file of files) {
  const size = gzipSync(readFileSync(`dist${file}`)).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(7)} KB  ${file}`);
}
const kb = total / 1024;
console.log(`${kb.toFixed(1).padStart(7)} KB  initial JavaScript (gzipped), budget ${BUDGET_KB} KB`);
if (kb > BUDGET_KB) {
  console.error('Over budget: lazy-load more.');
  process.exit(1);
}
