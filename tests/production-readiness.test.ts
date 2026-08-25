import assert from 'node:assert/strict';
import test from 'node:test';
import { createHealthService, type ReadinessDependencies } from '../lib/infrastructure/health.ts';
import { initializeProduction, type ProductionInitialization } from '../lib/infrastructure/initialization.ts';
import { createMemoryObjectStorage, verifyStoredAsset } from '../lib/infrastructure/object-storage.ts';
import { mediaAssetUrl } from '../lib/media/asset-url.ts';
import { validateProductionConfig } from '../lib/infrastructure/config.ts';
import { createStructuredObserver } from '../lib/infrastructure/observability.ts';

const readyDependencies = (): ReadinessDependencies => ({
  database: { check: async () => ({ ok: true, detail: 'reachable' }) },
  ecdict: { check: async () => ({ ok: true, detail: '60000 entries' }) },
  catalog: { check: async () => ({ ok: true, detail: '2 published courses indexed' }) },
  media: { check: async () => ({ ok: true, detail: 'read/write verified' }) },
});

test('liveness does not depend on infrastructure while readiness reports each production capability', async () => {
  const health = createHealthService(readyDependencies());
  assert.deepEqual(health.liveness(), { status: 'live', service: 'fluent-science-reading' });
  assert.deepEqual(await health.readiness(), {
    status: 'ready',
    checks: {
      database: { status: 'ready', detail: 'reachable' },
      ecdict: { status: 'ready', detail: '60000 entries' },
      catalog: { status: 'ready', detail: '2 published courses indexed' },
      media: { status: 'ready', detail: 'read/write verified' },
    },
  });
});

test('readiness degrades explicitly when initialization is incomplete or a dependency throws', async () => {
  const dependencies = readyDependencies();
  dependencies.ecdict = { check: async () => ({ ok: false, detail: 'required entry "flower" is missing' }) };
  dependencies.media = { check: async () => { throw new Error('bucket unavailable'); } };
  const result = await createHealthService(dependencies).readiness();
  assert.equal(result.status, 'degraded');
  assert.deepEqual(result.checks.ecdict, { status: 'failed', detail: 'required entry "flower" is missing' });
  assert.deepEqual(result.checks.media, { status: 'failed', detail: 'bucket unavailable' });
});

test('fresh initialization and repeated initialization use the same ordered, idempotent entry point', async () => {
  const calls: string[] = [];
  const initialization: ProductionInitialization = {
    migrate: async () => { calls.push('migrate'); },
    importEcdict: async () => { calls.push('ecdict'); return { imported: 60_000 }; },
    rebuildCatalog: async () => { calls.push('catalog'); return { indexed: 12 }; },
    prepareMedia: async () => { calls.push('media'); return { prepared: 1 }; },
    verify: async () => { calls.push('verify'); return { ready: true }; },
  };

  const first = await initializeProduction(initialization);
  const second = await initializeProduction(initialization);
  assert.deepEqual(first, { status: 'ready', ecdictEntries: 60_000, catalogEntries: 12, mediaAssets: 1 });
  assert.deepEqual(second, first);
  assert.deepEqual(calls, ['migrate', 'ecdict', 'catalog', 'media', 'verify', 'migrate', 'ecdict', 'catalog', 'media', 'verify']);
});

test('initialization stops at a failed phase and a later run safely resumes the complete workflow', async () => {
  let catalogAttempts = 0;
  let verified = 0;
  const initialization: ProductionInitialization = {
    migrate: async () => {},
    importEcdict: async () => ({ imported: 60_000 }),
    rebuildCatalog: async () => {
      catalogAttempts += 1;
      if (catalogAttempts === 1) throw new Error('temporary database failure');
      return { indexed: 12 };
    },
    prepareMedia: async () => ({ prepared: 1 }),
    verify: async () => { verified += 1; return { ready: true }; },
  };

  await assert.rejects(initializeProduction(initialization), /catalog: temporary database failure/);
  assert.equal(verified, 0);
  assert.deepEqual(await initializeProduction(initialization), {
    status: 'ready', ecdictEntries: 60_000, catalogEntries: 12, mediaAssets: 1,
  });
  assert.equal(verified, 1);
});

test('Illustration and Pronunciation Assets can be uploaded, read, and verified through object storage', async () => {
  const storage = createMemoryObjectStorage();
  const illustration = new TextEncoder().encode('png bytes');
  const pronunciation = new TextEncoder().encode('mp3 bytes');
  await storage.put('illustrations/flower.png', illustration, { contentType: 'image/png' });
  await storage.put('pronunciations/flower-us.mp3', pronunciation, { contentType: 'audio/mpeg' });

  assert.deepEqual(await storage.get('illustrations/flower.png'), {
    body: illustration, contentType: 'image/png', size: 9,
  });
  assert.deepEqual(await verifyStoredAsset(storage, 'pronunciations/flower-us.mp3'), {
    ok: true, contentType: 'audio/mpeg', size: 9,
  });
});

test('relative prepared media paths are read through the product media API', () => {
  assert.equal(mediaAssetUrl('media/flower image.png'), '/api/media/media/flower%20image.png');
  assert.equal(mediaAssetUrl('/api/pronunciation?word=flower&region=us'), '/api/pronunciation?word=flower&region=us');
  assert.equal(mediaAssetUrl('https://example.test/flower.png'), 'https://example.test/flower.png');
});

test('production configuration fails closed when a required adapter binding or initialization secret is missing', () => {
  assert.deepEqual(validateProductionConfig({ DB: {}, FILES: {}, CONTENT_EDITOR_PREVIEW_TOKEN: 'secret' }), []);
  assert.deepEqual(validateProductionConfig({ DB: {}, FILES: null, CONTENT_EDITOR_PREVIEW_TOKEN: '' }), [
    'FILES object storage binding is required',
    'CONTENT_EDITOR_PREVIEW_TOKEN is required',
  ]);
});

test('structured observability records operational fields without student free text', () => {
  const records: unknown[] = [];
  const observe = createStructuredObserver(record => records.push(record));
  observe({
    name: 'dictionary.lookup', outcome: 'success', durationMs: 18, cacheStatus: 'hit',
    providerStatus: 'found', stale: false,
    sentence: 'A student selected this private sentence', courseId: 'course-a',
  });
  assert.deepEqual(records, [{
    name: 'dictionary.lookup', outcome: 'success', durationMs: 18, cacheStatus: 'hit',
    providerStatus: 'found', stale: false,
  }]);
});

test('production initialization rejects a dictionary payload below the required operational size', async () => {
  const initialization: ProductionInitialization = {
    migrate: async () => {},
    importEcdict: async () => { throw new Error('expected at least 50000 entries'); },
    rebuildCatalog: async () => ({ indexed: 0 }),
    prepareMedia: async () => ({ prepared: 0 }),
    verify: async () => ({ ready: true }),
  };
  await assert.rejects(initializeProduction(initialization), /ecdict: expected at least 50000 entries/);
});
