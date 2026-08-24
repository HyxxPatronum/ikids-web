import assert from 'node:assert/strict';
import test from 'node:test';
import { createDictionaryService, normalizeLookup, resolveLexeme } from '../lib/dictionary/service.ts';
import { createMemoryCache, createMemoryCatalog, createMemoryProvider } from '../lib/dictionary/memory-adapters.ts';

test('normalizes the selected scope and resolves common surface forms', () => {
  assert.equal(normalizeLookup('  Flowers. '), 'flowers');
  assert.equal(resolveLexeme('flowers'), 'flower');
  assert.equal(resolveLexeme('grew'), 'grow');
});

test('returns the stable contract and ranks course context without changing catalog membership', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({ flower: { phonetic: '/flaʊər/', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'the bloom of a plant' }] }], provider: 'Fixture' } }),
    catalog: createMemoryCatalog({ categories: { flower: 'level2' }, courses: { flower: { meaning: '花朵', image: 'flower.png', sources: [{ title: 'Flowers' }] } } }),
    cache: createMemoryCache(),
  });
  const result = await service.lookup({ surfaceForm: 'Flowers,', scope: 'Flowers', language: 'en' });
  assert.equal(result.lexeme, 'flower');
  assert.equal(result.category, 'level2');
  assert.equal(result.meaning, '花朵');
  assert.equal(result.provider, 'Fixture');
  assert.equal(result.cacheStatus, 'miss');
});

test('keeps course catalog classification after inflected lookup normalization', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({ flower: { provider: 'Fixture' } }),
    catalog: createMemoryCatalog({ categories: { flower: 'level2' }, courses: { flower: { meaning: '花朵' } } }),
  });
  const result = await service.lookup({ surfaceForm: 'Flowers,', scope: 'Flowers', language: 'en' });
  assert.equal(result.lexeme, 'flower');
  assert.equal(result.category, 'level2');
  assert.equal(result.catalogMembership, 'level2');
});

test('supports not-found and provider-failure contract states without external access', async () => {
  const missing = createDictionaryService({ provider: createMemoryProvider({}) });
  await assert.rejects(missing.lookup('unknownword'), (error: any) => error.code === 'NOT_FOUND' && error.status === 404);
  const failed = createDictionaryService({ provider: createMemoryProvider({ broken: new Error('offline') }) });
  await assert.rejects(failed.lookup('broken'), (error: any) => error.code === 'PROVIDER_UNAVAILABLE' && error.status === 503);
});

test('deduplicates concurrent provider requests and serves the positive cache', async () => {
  let calls = 0;
  const cache = createMemoryCache();
  const service = createDictionaryService({ provider: async () => { calls += 1; await Promise.resolve(); return { provider: 'Fixture' }; }, cache });
  await Promise.all([service.lookup('flower'), service.lookup('flower')]);
  const cached = await service.lookup('flower');
  assert.equal(calls, 1);
  assert.equal(cached.cacheStatus, 'hit');
});
