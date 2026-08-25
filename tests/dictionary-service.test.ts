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

test('applies configurable positive, negative, and stale-success cache lifetimes', async () => {
  let now = 1_000;
  let providerAvailable = true;
  const cache = createMemoryCache(() => now);
  const service = createDictionaryService({
    provider: async lexeme => {
      if (!providerAvailable) throw new Error('offline');
      return lexeme === 'flower' ? { provider: 'Fixture', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a bloom' }] }] } : null;
    },
    cache,
    positiveTtlMs: 100,
    negativeTtlMs: 20,
    staleTtlMs: 300,
  });

  assert.equal((await service.lookup('flower')).cacheStatus, 'miss');
  now += 101;
  providerAvailable = false;
  assert.equal((await service.lookup('flower')).cacheStatus, 'stale');
  now += 300;
  await assert.rejects(service.lookup('flower'), (error: any) => error.code === 'PROVIDER_UNAVAILABLE');

  providerAvailable = true;
  await assert.rejects(service.lookup('absent'), (error: any) => error.code === 'NOT_FOUND');
  providerAvailable = false;
  now += 19;
  await assert.rejects(service.lookup('absent'), (error: any) => error.code === 'NOT_FOUND');
  now += 2;
  await assert.rejects(service.lookup('absent'), (error: any) => error.code === 'PROVIDER_UNAVAILABLE');
});

test('reports independent result-block state while preserving local results through provider failure', async () => {
  const service = createDictionaryService({
    provider: async () => { throw new Error('offline'); },
    catalog: courseCatalog({
      meaning: 'the lesson meaning',
      illustration: { src: 'media/flower.png', alt: 'A flower opening', source: 'course-library', review: 'approved' },
      pronunciations: [{ region: 'us', src: 'media/flower-us.mp3', source: 'studio', storage: 'r2', availability: 'ready' }],
    }),
  });

  const result = await service.lookup('flower');
  assert.equal(result.meaning, 'the lesson meaning');
  assert.equal(result.illustration?.src, 'media/flower.png');
  assert.deepEqual(result.sourceStatus.blocks, {
    courseSense: 'ready',
    localDictionary: 'not_requested',
    externalDictionary: 'unavailable',
    pronunciation: 'ready',
    illustration: 'ready',
  });
});

test('a prepared course pronunciation stays ready while an external dictionary uses stale cache', async () => {
  let now = 100;
  let available = true;
  const service = createDictionaryService({
    now: () => now,
    cache: createMemoryCache(() => now),
    positiveTtlMs: 10,
    staleTtlMs: 20,
    provider: async () => {
      if (!available) throw new Error('offline');
      return { provider: 'Fixture', meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'cached meaning' }] }] };
    },
    catalog: courseCatalog({
      pronunciations: [{ region: 'us', src: 'media/flower-us.mp3', source: 'studio', storage: 'r2', availability: 'ready' }],
    }),
  });

  await service.lookup('flower');
  now += 11;
  available = false;
  const stale = await service.lookup('flower');
  assert.equal(stale.sourceStatus.blocks.externalDictionary, 'stale');
  assert.equal(stale.sourceStatus.blocks.pronunciation, 'ready');
});

test('emits one aggregate metric for success, not-found, provider failure, cache hits, and stale use', async () => {
  let now = 10;
  let mode: 'found' | 'missing' | 'failed' = 'found';
  const metrics: Array<Record<string, unknown>> = [];
  const service = createDictionaryService({
    now: () => now,
    cache: createMemoryCache(() => now),
    positiveTtlMs: 10,
    staleTtlMs: 20,
    provider: async () => {
      now += 7;
      if (mode === 'failed') throw new Error('offline');
      return mode === 'found' ? { provider: 'Fixture' } : null;
    },
    observe: metric => metrics.push(metric),
  });

  await service.lookup('flower');
  await service.lookup('flower');
  mode = 'missing';
  await assert.rejects(service.lookup('absent'), (error: any) => error.code === 'NOT_FOUND');
  mode = 'failed';
  await assert.rejects(service.lookup('broken'), (error: any) => error.code === 'PROVIDER_UNAVAILABLE');
  now += 11;
  assert.equal((await service.lookup('flower')).cacheStatus, 'stale');

  assert.deepEqual(metrics.map(metric => ({
    outcome: metric.outcome,
    cacheStatus: metric.cacheStatus,
    providerStatus: metric.providerStatus,
    stale: metric.stale,
  })), [
    { outcome: 'success', cacheStatus: 'miss', providerStatus: 'found', stale: false },
    { outcome: 'success', cacheStatus: 'hit', providerStatus: 'found', stale: false },
    { outcome: 'not_found', cacheStatus: 'miss', providerStatus: 'not_found', stale: false },
    { outcome: 'provider_failure', cacheStatus: 'miss', providerStatus: 'unavailable', stale: false },
    { outcome: 'success', cacheStatus: 'stale', providerStatus: 'unavailable', stale: true },
  ]);
  assert.deepEqual(metrics.map(metric => metric.durationMs), [7, 0, 7, 7, 7]);
});

const courseCatalog = (course: Record<string, unknown>) => ({
  categoryFor: () => 'science' as const,
  courseFor: () => course,
});

test('a prepared course recording is preferred over the proxied provider recording', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({ flower: { provider: 'Fixture', pronunciations: [
      { region: 'us', label: '美音', phonetic: '/ˈflaʊ.ɚ/', audio: 'https://api.dictionaryapi.dev/media/flower-us.mp3' },
      { region: 'uk', label: '英音', phonetic: '/ˈflaʊ.ə/', audio: 'https://api.dictionaryapi.dev/media/flower-uk.mp3' },
    ] } }),
    catalog: courseCatalog({
      meaning: '花朵',
      pronunciations: [{ region: 'us', src: 'media/flower-us.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'ready' }],
    }),
  });

  const result = await service.lookup('flower');
  assert.deepEqual(result.accents.map(accent => [accent.region, accent.source, accent.audioUrl]), [
    ['us', 'course', 'media/flower-us.mp3'],
    ['uk', 'provider', '/api/pronunciation?word=flower&region=uk'],
  ]);
  assert.equal(result.accents[0].phonetic, '/ˈflaʊ.ɚ/');
});

test('an accent without any usable recording is offered as device speech only', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({ flower: { provider: 'Fixture', pronunciations: [
      { region: 'uk', label: '英音', phonetic: '/ˈflaʊ.ə/', audio: 'https://api.dictionaryapi.dev/media/flower-uk.mp3' },
      { region: 'other', label: '词典音频', phonetic: '', audio: 'https://api.dictionaryapi.dev/media/flower.mp3' },
    ] } }),
    catalog: courseCatalog({
      meaning: '花朵',
      pronunciations: [{ region: 'us', src: 'media/flower-us.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'pending' }],
    }),
  });

  const result = await service.lookup('flower');
  assert.deepEqual(result.accents.map(accent => [accent.region, accent.source]), [['us', 'none'], ['uk', 'provider']]);
});

test('one provider recording is never published under both accent labels', async () => {
  const service = createDictionaryService({
    provider: createMemoryProvider({ flower: { provider: 'Fixture', pronunciations: [
      { region: 'us', label: '美音', phonetic: '', audio: 'https://api.dictionaryapi.dev/media/flower.mp3' },
      { region: 'uk', label: '英音', phonetic: '', audio: 'https://api.dictionaryapi.dev/media/flower.mp3' },
    ] } }),
  });

  const result = await service.lookup('flower');
  assert.deepEqual(result.accents.map(accent => [accent.region, accent.source]), [['us', 'provider'], ['uk', 'none']]);
});

test('only a reviewed illustration with alternative text reaches student lookup', async () => {
  const approved = createDictionaryService({
    provider: createMemoryProvider({ flower: { provider: 'Fixture' } }),
    catalog: courseCatalog({
      meaning: '花朵',
      illustration: { src: 'media/flower.png', alt: '一朵正在开放的花', source: '课程插图库', review: 'approved' },
    }),
  });
  assert.deepEqual((await approved.lookup('flower')).illustration, {
    src: 'media/flower.png', alt: '一朵正在开放的花', source: '课程插图库',
  });

  const unreviewed = createDictionaryService({
    provider: createMemoryProvider({ flower: { provider: 'Fixture' } }),
    catalog: courseCatalog({
      meaning: '花朵',
      illustration: { src: 'media/flower.png', alt: '一朵正在开放的花', source: '课程插图库', review: 'pending' },
    }),
  });
  assert.equal((await unreviewed.lookup('flower')).illustration, null);
});
