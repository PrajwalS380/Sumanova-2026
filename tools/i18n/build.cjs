// Builds src/i18n/<lang>.json from tools/i18n/*.tsv (columns: English, hi, kn, ta, te).
// Keys are normalised the same way the runtime translator normalises screen text.
const fs = require('fs');
const path = require('path');
const LANGS = ['hi', 'kn', 'ta', 'te'];
const norm = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/\s+/g, ' ').trim();
// Single words that are also common first names stay English, so a friend called Leo is never renamed.
const NAME_LIKE = new Set(['Leo', 'Sky', 'Aurora', 'Sun', 'Queen', 'Winner']);
const out = Object.fromEntries(LANGS.map((l) => [l, {}]));
let rows = 0, bad = 0;
for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith('.tsv')).sort()) {
  for (const [n, line] of fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length !== 5 || cols.some((c) => !c.trim())) {
      console.error(`${f}:${n + 1} has ${cols.length} columns`);
      bad++;
      continue;
    }
    const key = norm(cols[0]);
    if (NAME_LIKE.has(key)) continue;
    LANGS.forEach((l, i) => (out[l][key] = cols[i + 1].trim()));
    rows++;
  }
}
fs.mkdirSync(path.join(__dirname, '../../src/i18n'), { recursive: true });
for (const l of LANGS) fs.writeFileSync(path.join(__dirname, `../../src/i18n/${l}.json`), JSON.stringify(out[l]));
console.log(`${rows} strings × ${LANGS.length} languages${bad ? `, ${bad} bad lines` : ''}`);
if (process.argv[2]) {
  const want = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).map(norm);
  const missing = want.filter((k) => !(k in out.hi));
  console.log(`missing ${missing.length}:`, missing.join(' | '));
}
if (bad) process.exit(1);
