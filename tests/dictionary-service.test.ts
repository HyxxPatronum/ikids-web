import assert from 'node:assert/strict';
import test from 'node:test';
import { createDictionaryService, normalizeLookup, resolveLexeme } from '../lib/dictionary/service.ts';
import { createMemoryCache, createMemoryCatalog, createMemoryProvider } from '../lib/dictionary/memory-adapters.ts';

test('normalizes the selected scope and resolves common surface forms', () => {
  assert.equal(normalizeLookup('  Flowers. '), 'flowers');
  assert.equal(resolveLexeme('flowers'), 'flower');
  assert.equal(resolveLexeme('grew'), 'grow');
});

test('keeps a successful exact match instead of replacing it with a lemma fallback', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({
      leaves: { provider: 'Exact fixture', meanings: [{ partOfSpeech: 'verb', definitions: [{ definition: 'goes away' }] }] },
      leaf: { provider: 'Lemma fixture', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'part of a plant' }] }] },
    }),
  });

  const result = await service.lookup({ surfaceForm: 'Leaves,', scope: 'Leaves' });
  assert.equal(result.lexeme, 'leaves');
  assert.equal(result.provider, 'Exact fixture');
});

test('tries an exact provider entry before a Course Term lemma mapping', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({
      leaves: { provider: 'Exact fixture' },
      leaf: { provider: 'Lemma fixture' },
    }),
    catalog: {
      categoryFor: () => 'science',
      courseFor: () => ({ lexeme: 'leaf', meaning: 'course meaning' }),
    },
  });

  const result = await service.lookup({ surfaceForm: 'leaves', scope: 'leaves' });
  assert.equal(result.lexeme, 'leaves');
  assert.equal(result.provider, 'Exact fixture');
});

test('falls back from common regular past and participle forms to their Lexemes', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({
      walk: { provider: 'Fixture' },
      stop: { provider: 'Fixture' },
      make: { provider: 'Fixture' },
    }),
  });

  const results = await Promise.all(['walked', 'stopped', 'walking', 'making'].map(surfaceForm => service.lookup(surfaceForm)));
  assert.deepEqual(results.map(result => result.lexeme), ['walk', 'stop', 'walk', 'make']);
});

test('prefers silent-e Lexemes over valid but orthographically wrong bare stems', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({
      hop: { provider: 'Wrong bare stem' },
      hope: { provider: 'Correct fixture' },
      rat: { provider: 'Wrong bare stem' },
      rate: { provider: 'Correct fixture' },
      us: { provider: 'Wrong bare stem' },
      use: { provider: 'Correct fixture' },
    }),
  });

  const results = await Promise.all(['hoped', 'rated', 'used'].map(surfaceForm => service.lookup(surfaceForm)));
  assert.deepEqual(results.map(result => result.lexeme), ['hope', 'rate', 'use']);
  assert.equal(resolveLexeme('making'), 'make');
  assert.equal(resolveLexeme('hoped'), 'hope');
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

test('uses explicit course and sentence context when selecting a Course Sense', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({ organism: { provider: 'Fixture' } }),
    catalog: {
      categoryFor: () => 'science',
      courseFor: (_lexeme, context) => context?.courseId === 'course-b'
        ? { meaning: 'the living thing discussed in course B' }
        : { meaning: 'a generic course meaning' },
    },
  });

  const result = await service.lookup({
    surfaceForm: 'organisms',
    scope: 'organisms',
    courseId: 'course-b',
    sentence: 'These organisms share the same habitat.',
  });
  assert.equal(result.meaning, 'the living thing discussed in course B');
  assert.deepEqual(result.context, {
    courseId: 'course-b',
    sentence: 'These organisms share the same habitat.',
  });
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
