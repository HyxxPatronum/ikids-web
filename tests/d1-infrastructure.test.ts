import assert from 'node:assert/strict';
import test from 'node:test';
import { createD1HealthDependencies, createD1PublishedCatalogRebuildStore } from '../lib/infrastructure/d1-adapter.ts';
import { createR2ObjectStorage } from '../lib/infrastructure/r2-object-storage.ts';

type Row = Record<string, unknown>;

function fakeDb(options: {
  state?: Record<string, string>;
  dictionaryCount?: number;
  flower?: boolean;
  catalogCount?: number;
} = {}) {
  const state = options.state || {};
  const batches: string[][] = [];
  const db = {
    prepare(query: string) {
      let bindings: unknown[] = [];
      return {
        bind(...values: unknown[]) { bindings = values; return this; },
        async first<T extends Row>() {
          if (query === 'SELECT 1 AS value') return { value: 1 } as unknown as T;
          if (query.includes('FROM infrastructure_state')) return state[String(bindings[0])] !== undefined ? { value: state[String(bindings[0])] } as unknown as T : null;
          if (query.includes('COUNT(*)') && query.includes('dictionary_entries')) return { count: options.dictionaryCount || 0 } as unknown as T;
          if (query.includes('FROM dictionary_entries WHERE word')) return options.flower ? { word: 'flower' } as unknown as T : null;
          if (query.includes('COUNT(*)') && query.includes('published_vocabulary_terms')) return { count: options.catalogCount || 0 } as unknown as T;
          return null;
        },
        async all<T extends Row>() { return { results: [] as T[] }; },
        async run() { return { success: true }; },
        query,
      };
    },
    async batch(statements: Array<{ query?: string }>) { batches.push(statements.map(statement => statement.query || '')); return []; },
  };
  return { db: db as unknown as D1Database, batches };
}

test('D1 readiness verifies database access, ECDICT content, Catalog state, and object storage', async () => {
  const { db } = fakeDb({
    state: { ecdict: '60000', catalog: '12' }, dictionaryCount: 60_000, flower: true, catalogCount: 12,
  });
  const objects = new Map<string, Uint8Array>();
  const bucket = {
    async put(key: string, body: Uint8Array) { objects.set(key, body); },
    async get(key: string) {
      const body = objects.get(key);
      return body ? { body: new Blob([body.slice().buffer]).stream(), httpMetadata: { contentType: 'application/octet-stream' }, size: body.byteLength } : null;
    },
    async delete(key: string) { objects.delete(key); },
    async head(key: string) { return objects.has(key) ? {} : null; },
  } as unknown as R2Bucket;
  const checks = createD1HealthDependencies(db, createR2ObjectStorage(bucket));
  for (const check of Object.values(checks)) assert.equal((await check.check()).ok, true);
});

test('D1 ECDICT health rejects an empty table even when the schema exists', async () => {
  const { db } = fakeDb({ state: { catalog: '0' } });
  const storage = { put: async () => {}, get: async () => null, delete: async () => {} };
  const result = await createD1HealthDependencies(db, storage).ecdict.check();
  assert.deepEqual(result, { ok: false, detail: 'ECDICT initialization marker is missing' });
});

test('D1 Catalog rebuild performs staging and student-visible replacement in one batch', async () => {
  const { db, batches } = fakeDb();
  const store = createD1PublishedCatalogRebuildStore(db);
  await store.replaceAll([]);
  assert.equal(batches.length, 1);
  assert.match(batches[0][0], /DELETE FROM published_vocabulary_terms_staging/);
  assert.match(batches[0].at(-2) || '', /INSERT INTO published_vocabulary_terms \(card_id,lexeme/);
  assert.doesNotMatch(batches[0].at(-2) || '', /SELECT \*/);
  assert.match(batches[0].at(-1) || '', /infrastructure_state/);
});
