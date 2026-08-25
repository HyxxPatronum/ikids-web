import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { normalizeContentCard } from '../content/card-normalization.ts';
import { createMemoryPublicationStore, createPublicationIndex } from '../catalog/publication-index.ts';
import { initializeProduction } from './initialization.ts';

export type D1InitializationOptions = {
  root: string; remote: boolean; persistArg?: string; databaseId: string; databaseName: string;
  bucketName: string;
  dictionary: { source: string; generatedAt?: string; count: number; entries: Record<string, string[]> };
  seedCards: Array<Record<string, any>>;
  verify(): Promise<{ ready: boolean }>;
  runCommand?: (args: string[], quiet: boolean) => string;
  minimumEcdictEntries?: number;
};

const escapeSql = (value: unknown) => String(value || '').replaceAll("'", "''").replaceAll('\0', '');

export async function initializeD1Production(options: D1InitializationOptions) {
  const cache = path.join(options.root, '.cache');
  await fs.mkdir(cache, { recursive: true });
  const configPath = path.join(cache, 'wrangler-initialize.json');
  await fs.writeFile(configPath, JSON.stringify({
    name: 'fluent-science-reading-initializer', compatibility_date: '2026-08-25',
    d1_databases: [{ binding: 'DB', database_name: options.databaseName, database_id: options.databaseId, migrations_dir: path.join(options.root, 'drizzle') }],
    r2_buckets: [{ binding: 'FILES', bucket_name: options.bucketName }],
  }));
  const mode = options.remote ? '--remote' : '--local';
  const persistence = options.persistArg ? [options.persistArg] : [];
  const config = ['--config', path.relative(options.root, configPath)];
  const run = options.runCommand || ((args: string[], quiet = false) => {
    const result = spawnSync(process.execPath, [path.join(options.root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), ...args], {
      cwd: options.root, encoding: 'utf8', shell: false,
      env: { ...process.env, XDG_CONFIG_HOME: path.join(cache, 'xdg'), WRANGLER_LOG_PATH: path.join(cache, 'wrangler', 'logs'), WRANGLER_WRITE_LOGS: 'false' },
    });
    if (!quiet && result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) throw new Error(`wrangler ${args.join(' ')} failed with exit code ${result.status}${result.error ? `: ${result.error.message}` : ''}`);
    return String(result.stdout || '');
  });
  const executeFile = (filename: string) => run(['d1', 'execute', 'DB', mode, ...persistence, `--file=${filename}`, ...config], true);
  let publishedCards: Array<Record<string, any>> = [];

  return initializeProduction({
    async migrate() { run(['d1', 'migrations', 'apply', 'DB', mode, ...persistence, ...config], false); },
    async importEcdict() {
      const dictionary = options.dictionary;
      const entries = Object.entries(dictionary.entries || {});
      const minimum = options.minimumEcdictEntries ?? 50_000;
      if (dictionary.source !== 'ECDICT' || dictionary.count < minimum || entries.length !== dictionary.count || !dictionary.entries?.flower) {
        throw new Error(`data/ecdict-compact.json must contain at least ${minimum} verified ECDICT entries including flower`);
      }
      const generatedAt = String(dictionary.generatedAt || new Date().toISOString());
      const statements: string[] = [];
      for (let index = 0; index < entries.length; index += 100) {
        const values = entries.slice(index, index + 100).map(([word, entry]) => `('${escapeSql(word)}','${escapeSql(entry[0])}','${escapeSql(entry[1])}','${escapeSql(entry[2])}','${escapeSql(entry[3])}','${escapeSql(entry[4])}','ECDICT','${escapeSql(generatedAt)}')`);
        statements.push(`INSERT INTO dictionary_entries (word,phonetic,translation,definition,pos,exchange,source,updated_at) VALUES\n${values.join(',\n')}\nON CONFLICT(word) DO UPDATE SET phonetic=excluded.phonetic,translation=excluded.translation,definition=excluded.definition,pos=excluded.pos,exchange=excluded.exchange,source=excluded.source,updated_at=excluded.updated_at;`);
      }
      statements.push(`INSERT INTO infrastructure_state (name,value,updated_at) VALUES ('ecdict','${entries.length}','${escapeSql(generatedAt)}') ON CONFLICT(name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;`);
      const filename = path.join(cache, 'ecdict-production-seed.sql');
      await fs.writeFile(filename, statements.join('\n')); executeFile(filename);
      return { imported: entries.length };
    },
    async rebuildCatalog() {
      const seeded: Array<Record<string, any>> = options.seedCards.map(card => normalizeContentCard({ ...card, status: card.status || 'published' }));
      const seedFilename = path.join(cache, 'content-production-seed.sql');
      const now = new Date().toISOString();
      const seedSql = [`INSERT INTO series (id,name,subtitle,description,sort_order,status,created_at,updated_at) VALUES ('science-reading','Science Reading','Nature, life science, and science stories','Learn science English through reading, listening, and practice',10,'published','${escapeSql(now)}','${escapeSql(now)}') ON CONFLICT(id) DO NOTHING;`];
      for (const card of seeded) seedSql.push(`INSERT INTO cards (id,slug,series_id,course_id,topic,theme,day,level,title,big_question,article_structure,image,content_json,status,updated_at) VALUES ('${escapeSql(card.cardId)}','${escapeSql(card.slug)}','${escapeSql(card.seriesId || card.courseId)}','${escapeSql(card.courseId)}','${escapeSql(card.topic)}','${escapeSql(card.theme)}',${Number(card.day || 0)},'${escapeSql(card.level)}','${escapeSql(card.title)}','${escapeSql(card.bigQuestion)}','${escapeSql(card.articleStructure)}','${escapeSql(card.image_file || card.image)}','${escapeSql(JSON.stringify(card))}','${escapeSql(card.status)}','${escapeSql(now)}') ON CONFLICT(id) DO NOTHING;`);
      await fs.writeFile(seedFilename, seedSql.join('\n')); executeFile(seedFilename);

      const query = run(['d1', 'execute', 'DB', mode, ...persistence, '--command=SELECT id,slug,title,theme,image,status,content_json FROM cards WHERE status=\'published\' ORDER BY id', '--json', ...config], true);
      const cards = (JSON.parse(query)[0]?.results || []).map((row: Record<string, string>) => ({ ...JSON.parse(row.content_json), cardId: row.id, slug: row.slug, title: row.title, theme: row.theme, image: row.image, status: row.status }));
      publishedCards = cards;
      const publicationStore = createMemoryPublicationStore(); const publicationIndex = createPublicationIndex(publicationStore);
      for (const card of cards) await publicationIndex.synchronize(card);
      const terms = await publicationStore.list();
      const statements = ['DELETE FROM published_vocabulary_terms_staging;'];
      for (const term of terms) {
        const media = JSON.stringify({ illustration: term.illustration, pronunciations: term.pronunciations });
        statements.push(`INSERT INTO published_vocabulary_terms_staging (card_id,lexeme,surface_form,meaning,image,media_json,membership,source_slug,source_title,source_theme,source_image,updated_at) VALUES ('${escapeSql(term.source.cardId)}','${escapeSql(term.lexeme)}','${escapeSql(term.english)}','${escapeSql(term.meaning)}','${escapeSql(term.image)}','${escapeSql(media)}','${escapeSql(term.membership)}','${escapeSql(term.source.slug)}','${escapeSql(term.source.title)}','${escapeSql(term.source.theme)}','${escapeSql(term.source.image)}','${escapeSql(now)}');`);
      }
      statements.push('DELETE FROM published_vocabulary_terms;', 'INSERT INTO published_vocabulary_terms SELECT * FROM published_vocabulary_terms_staging;', `INSERT INTO infrastructure_state (name,value,updated_at) VALUES ('catalog','${terms.length}','${escapeSql(now)}') ON CONFLICT(name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;`);
      const filename = path.join(cache, 'catalog-production-seed.sql'); await fs.writeFile(filename, statements.join('\n')); executeFile(filename);
      return { indexed: terms.length };
    },
    async prepareMedia() {
      const assets = new Set<string>();
      for (const card of publishedCards) {
        if (card.image_file || card.image) assets.add(String(card.image_file || card.image));
        const media = [card, ...(card.word_bank || [])];
        for (const item of media) {
          if (item?.illustration?.src) assets.add(String(item.illustration.src));
          for (const pronunciation of item?.pronunciations || []) if (pronunciation?.src) assets.add(String(pronunciation.src));
        }
      }
      let prepared = 0;
      for (const key of assets) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(key) || key.includes('..') || key.includes('\\')) throw new Error(`invalid media asset path: ${key}`);
        const filename = path.join(options.root, key);
        try { await fs.access(filename); } catch { throw new Error(`referenced media asset is missing: ${key}`); }
        const contentType = /\.png$/i.test(key) ? 'image/png' : /\.jpe?g$/i.test(key) ? 'image/jpeg' : /\.mp3$/i.test(key) ? 'audio/mpeg' : /\.wav$/i.test(key) ? 'audio/wav' : 'application/octet-stream';
        run(['r2', 'object', 'put', `${options.bucketName}/${key}`, mode, ...persistence, `--file=${filename}`, `--content-type=${contentType}`, '--force', ...config], true);
        prepared += 1;
      }
      return { prepared };
    },
    verify: options.verify,
  });
}
