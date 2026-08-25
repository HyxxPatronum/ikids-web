import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.resolve(root, process.argv.find(arg => arg.startsWith('--source='))?.slice(9) || '.cache/ecdict-package/package/assets/ecdict.csv');
const limit = Math.max(1000, Number(process.argv.find(arg => arg.startsWith('--limit='))?.slice(8) || 60000));
const output = path.join(root, 'data', 'ecdict-compact.json');
const sqlOutput = path.join(root, '.cache', 'ecdict-seed.sql');

const normalizeWord = value => String(value || '').trim().toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
const validWord = word => word.length <= 80 && /^[a-z]+(?:['-][a-z]+)*(?:\s+[a-z]+(?:['-][a-z]+)*)*$/.test(word);
const hasChinese = value => /[\u3400-\u9fff]/.test(value);
const rankOf = value => { const rank = Number(value); return Number.isFinite(rank) && rank > 0 ? rank : Number.MAX_SAFE_INTEGER; };

async function requiredWords() {
  const required = new Set();
  for (const filename of ['vocabulary-level2.json', 'vocabulary-level3.json']) {
    const words = JSON.parse(await fsp.readFile(path.join(root, 'data', filename), 'utf8'));
    for (const entry of words) for (const variant of String(entry).replace(/\([^)]*\)/g, '').split('/')) {
      const word = normalizeWord(variant); if (validWord(word)) required.add(word);
    }
  }
  for (const filename of await fsp.readdir(root)) {
    if (!filename.endsWith('.json') || filename === 'package.json') continue;
    try {
      const card = JSON.parse(await fsp.readFile(path.join(root, filename), 'utf8'));
      for (const entry of card.word_bank || []) { const word = normalizeWord(entry.english); if (validWord(word)) required.add(word); }
    } catch {}
  }
  return required;
}

async function* csvRecords(filename) {
  const stream = fs.createReadStream(filename, { encoding:'utf8' });
  let fields = [], field = '', quoted = false, pendingQuote = false;
  for await (const chunk of stream) {
    for (const char of chunk) {
      if (pendingQuote) {
        if (char === '"') { field += '"'; pendingQuote = false; continue; }
        quoted = false; pendingQuote = false;
      }
      if (quoted) { if (char === '"') pendingQuote = true; else field += char; continue; }
      if (char === '"' && !field) { quoted = true; continue; }
      if (char === ',') { fields.push(field); field = ''; continue; }
      if (char === '\n') { fields.push(field.replace(/\r$/, '')); yield fields; fields = []; field = ''; continue; }
      field += char;
    }
  }
  if (field || fields.length) { fields.push(field); yield fields; }
}

const required = await requiredWords();
const candidates = new Map();
let header = null;
for await (const fields of csvRecords(source)) {
  if (!header) { header = Object.fromEntries(fields.map((name, index) => [name.replace(/^\uFEFF/, ''), index])); continue; }
  const word = normalizeWord(fields[header.word]);
  const translation = String(fields[header.translation] || '').trim();
  if (!validWord(word) || !translation || !hasChinese(translation)) continue;
  const bnc = rankOf(fields[header.bnc]); const frq = rankOf(fields[header.frq]); const tag = String(fields[header.tag] || '');
  const priority = required.has(word) ? -1_000_000 : Math.min(bnc, frq) - (/\b(?:zk|gk|cet4|cet6|ky|toefl|ielts)\b/i.test(tag) ? 10_000 : 0);
  const entry = [String(fields[header.phonetic] || ''), translation, String(fields[header.definition] || ''), String(fields[header.pos] || ''), String(fields[header.exchange] || '')];
  const current = candidates.get(word);
  if (!current || priority < current.priority) candidates.set(word, { priority, entry });
}

const selected = [...candidates].sort((a, b) => a[1].priority - b[1].priority || a[0].localeCompare(b[0])).slice(0, limit);
const entries = Object.fromEntries(selected.sort((a, b) => a[0].localeCompare(b[0])).map(([word, value]) => [word, value.entry]));
const missingRequired = [...required].filter(word => !entries[word]);
const payload = { version:1, source:'ECDICT', sourceUrl:'https://github.com/skywind3000/ECDICT', license:'MIT', generatedAt:new Date().toISOString(), count:Object.keys(entries).length, entries };
await fsp.mkdir(path.dirname(output), { recursive:true });
await fsp.writeFile(output, JSON.stringify(payload));

const sqlEscape = value => String(value || '').replaceAll("'", "''").replaceAll('\0', '');
const statements = ['BEGIN;', 'CREATE TABLE IF NOT EXISTS dictionary_entries (word TEXT PRIMARY KEY, phonetic TEXT NOT NULL DEFAULT \'\', translation TEXT NOT NULL, definition TEXT NOT NULL DEFAULT \'\', pos TEXT NOT NULL DEFAULT \'\', exchange TEXT NOT NULL DEFAULT \'\', source TEXT NOT NULL DEFAULT \'ECDICT\', updated_at TEXT NOT NULL);'];
const generatedAt = payload.generatedAt;
for (let index = 0; index < selected.length; index += 100) {
  const values = selected.slice(index, index + 100).map(([word, { entry }]) => `('${sqlEscape(word)}','${sqlEscape(entry[0])}','${sqlEscape(entry[1])}','${sqlEscape(entry[2])}','${sqlEscape(entry[3])}','${sqlEscape(entry[4])}','ECDICT','${generatedAt}')`);
  statements.push(`INSERT INTO dictionary_entries (word,phonetic,translation,definition,pos,exchange,source,updated_at) VALUES\n${values.join(',\n')}\nON CONFLICT(word) DO UPDATE SET phonetic=excluded.phonetic,translation=excluded.translation,definition=excluded.definition,pos=excluded.pos,exchange=excluded.exchange,source=excluded.source,updated_at=excluded.updated_at;`);
}
statements.push('COMMIT;');
await fsp.mkdir(path.dirname(sqlOutput), { recursive:true });
await fsp.writeFile(sqlOutput, statements.join('\n'));
console.log(`ECDICT index: ${payload.count} entries -> ${path.relative(root, output)}`);
console.log(`D1 seed: ${path.relative(root, sqlOutput)}`);
if (missingRequired.length) console.warn(`Required words missing Chinese entries: ${missingRequired.slice(0, 20).join(', ')}${missingRequired.length > 20 ? ` (+${missingRequired.length - 20})` : ''}`);
