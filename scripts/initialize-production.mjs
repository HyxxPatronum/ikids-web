import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import flower from '../day001-flower.json' with { type: 'json' };
import cactus from '../science-reader-100-how-a-cactus-saves-water.json' with { type: 'json' };
import { createMemoryPublicationStore, createPublicationIndex } from '../lib/catalog/publication-index.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const remote = process.argv.includes('--remote');
const local = process.argv.includes('--local');
if (remote === local) throw new Error('Pass exactly one of --local or --remote');
const urlArg = process.argv.find(argument => argument.startsWith('--url='));
const baseUrl = String(urlArg?.slice(6) || '').replace(/\/$/, '');
const persistArg = process.argv.find(argument => argument.startsWith('--persist-to='));
const persistence = persistArg ? [persistArg] : [];
const skipApplication = process.argv.includes('--skip-application');
if (!baseUrl && !skipApplication) throw new Error('Pass --url=<deployed application URL> or --skip-application');
const token = String(process.env.CONTENT_EDITOR_PREVIEW_TOKEN || '').trim();
if (!token) throw new Error('CONTENT_EDITOR_PREVIEW_TOKEN is required');
const databaseId = remote ? String(process.env.CLOUDFLARE_D1_DATABASE_ID || '').trim() : '00000000-0000-4000-8000-000000000000';
if (!databaseId) throw new Error('CLOUDFLARE_D1_DATABASE_ID is required for --remote');
const cliConfigPath = path.join(root, '.cache', 'wrangler-initialize.json');
await fs.mkdir(path.dirname(cliConfigPath), { recursive: true });
await fs.writeFile(cliConfigPath, JSON.stringify({
  name: 'fluent-science-reading-initializer',
  compatibility_date: '2026-08-25',
  d1_databases: [{
    binding: 'DB',
    database_name: String(process.env.CLOUDFLARE_D1_DATABASE_NAME || 'fluent-science-reading'),
    database_id: databaseId,
    migrations_dir: path.join(root, 'drizzle'),
  }],
}));
const config = ['--config', path.relative(root, cliConfigPath)];

const run = (_command, args) => {
  const executable = process.execPath;
  const cli = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const commandArgs = [cli, ...args.slice(1)];
  const result = spawnSync(executable, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      XDG_CONFIG_HOME: path.join(root, '.cache', 'xdg'),
      WRANGLER_LOG_PATH: path.join(root, '.cache', 'wrangler', 'logs'),
      WRANGLER_WRITE_LOGS: 'false',
    },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const cause = result.error ? `: ${result.error.message}` : '';
    throw new Error(`wrangler ${commandArgs.slice(1).join(' ')} failed with exit code ${result.status}${cause}`);
  }
};

const mode = remote ? '--remote' : '--local';
run('npx', ['wrangler', 'd1', 'migrations', 'apply', 'DB', mode, ...persistence, ...config]);

const dictionary = JSON.parse(await fs.readFile(path.join(root, 'data', 'ecdict-compact.json'), 'utf8'));
if (dictionary.source !== 'ECDICT' || !dictionary.count || !dictionary.entries?.flower) {
  throw new Error('data/ecdict-compact.json is not a verified ECDICT payload');
}
const escapeSql = value => String(value || '').replaceAll("'", "''").replaceAll('\0', '');
const generatedAt = String(dictionary.generatedAt || new Date().toISOString());
const statements = [];
const entries = Object.entries(dictionary.entries);
for (let index = 0; index < entries.length; index += 100) {
  const values = entries.slice(index, index + 100).map(([word, entry]) =>
    `('${escapeSql(word)}','${escapeSql(entry[0])}','${escapeSql(entry[1])}','${escapeSql(entry[2])}','${escapeSql(entry[3])}','${escapeSql(entry[4])}','ECDICT','${escapeSql(generatedAt)}')`);
  statements.push(`INSERT INTO dictionary_entries (word,phonetic,translation,definition,pos,exchange,source,updated_at) VALUES\n${values.join(',\n')}\nON CONFLICT(word) DO UPDATE SET phonetic=excluded.phonetic,translation=excluded.translation,definition=excluded.definition,pos=excluded.pos,exchange=excluded.exchange,source=excluded.source,updated_at=excluded.updated_at;`);
}
statements.push(`INSERT INTO infrastructure_state (name,value,updated_at) VALUES ('ecdict','${entries.length}','${escapeSql(generatedAt)}') ON CONFLICT(name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;`);
const seedPath = path.join(root, '.cache', 'ecdict-production-seed.sql');
await fs.mkdir(path.dirname(seedPath), { recursive: true });
await fs.writeFile(seedPath, statements.join('\n'));
run('npx', ['wrangler', 'd1', 'execute', 'DB', mode, ...persistence, `--file=${seedPath}`, ...config]);

const cards = [flower, cactus].map(card => ({ ...card, status: card.status || 'published' }));
const publicationStore = createMemoryPublicationStore();
const publicationIndex = createPublicationIndex(publicationStore);
for (const card of cards) await publicationIndex.synchronize(card);
const terms = await publicationStore.list();
const now = new Date().toISOString();
const contentStatements = [`INSERT INTO series (id,name,subtitle,description,sort_order,status,created_at,updated_at) VALUES ('science-reading','Science Reading','Nature, life science, and science stories','Learn science English through reading, listening, and practice',10,'published','${escapeSql(now)}','${escapeSql(now)}') ON CONFLICT(id) DO NOTHING;`];
const aliases = new Map([
  ['feature-function','Feature-Function'],['feature / function','Feature-Function'],['feature → function','Feature-Function'],
  ['cause-effect','Cause-Effect'],['cause / effect','Cause-Effect'],['cause → effect','Cause-Effect'],
  ['process/life cycle','Process/Life cycle'],['process / life cycle','Process/Life cycle'],
  ['compare-contrast','Compare-Contrast'],['compare / contrast','Compare-Contrast'],
  ['fact/explanation','Fact/Explanation'],['fact / explanation','Fact/Explanation'],
]);
for (const card of cards) {
  const structure = aliases.get(String(card.articleStructure || card.structure || '').trim().toLowerCase()) || card.articleStructure || card.structure || '';
  const slug = card.slug || `${String(card.courseId || 'course').toLowerCase()}-${card.day}-${String(card.title || card.cardId).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
  contentStatements.push(`INSERT INTO cards (id,slug,series_id,course_id,topic,theme,day,level,title,big_question,article_structure,image,content_json,status,updated_at) VALUES ('${escapeSql(card.cardId)}','${escapeSql(slug)}','${escapeSql(card.seriesId || card.courseId)}','${escapeSql(card.courseId)}','${escapeSql(card.topic)}','${escapeSql(card.theme)}',${Number(card.day || 0)},'${escapeSql(card.level)}','${escapeSql(card.title)}','${escapeSql(card.bigQuestion)}','${escapeSql(structure)}','${escapeSql(card.image_file || card.image)}','${escapeSql(JSON.stringify({ ...card, slug, articleStructure: structure, structure }))}','${escapeSql(card.status)}','${escapeSql(now)}') ON CONFLICT(id) DO NOTHING;`);
}
contentStatements.push('DELETE FROM published_vocabulary_terms_staging;');
for (const term of terms) {
  const media = JSON.stringify({ illustration: term.illustration, pronunciations: term.pronunciations });
  contentStatements.push(`INSERT INTO published_vocabulary_terms_staging (card_id,lexeme,surface_form,meaning,image,media_json,membership,source_slug,source_title,source_theme,source_image,updated_at) VALUES ('${escapeSql(term.source.cardId)}','${escapeSql(term.lexeme)}','${escapeSql(term.english)}','${escapeSql(term.meaning)}','${escapeSql(term.image)}','${escapeSql(media)}','${escapeSql(term.membership)}','${escapeSql(term.source.slug)}','${escapeSql(term.source.title)}','${escapeSql(term.source.theme)}','${escapeSql(term.source.image)}','${escapeSql(now)}');`);
}
contentStatements.push('DELETE FROM published_vocabulary_terms;', 'INSERT INTO published_vocabulary_terms SELECT * FROM published_vocabulary_terms_staging;', `INSERT INTO infrastructure_state (name,value,updated_at) VALUES ('catalog','${terms.length}','${escapeSql(now)}') ON CONFLICT(name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;`);
const contentPath = path.join(root, '.cache', 'content-production-seed.sql');
await fs.writeFile(contentPath, contentStatements.join('\n'));
run('npx', ['wrangler', 'd1', 'execute', 'DB', mode, ...persistence, `--file=${contentPath}`, ...config]);

if (skipApplication) process.exit(0);
const response = await fetch(`${baseUrl}/api/health`);
const result = await response.json();
if (!response.ok) throw new Error(`Application readiness failed: ${JSON.stringify(result)}`);
process.stdout.write(`${JSON.stringify(result)}\n`);
