import assert from 'node:assert/strict';
import test from 'node:test';
import { createFreeDictionaryAdapter } from '../lib/dictionary/free-dictionary-adapter.ts';

test('external English lookup stays behind a provider adapter and normalizes its stable result', async () => {
  const provider = createFreeDictionaryAdapter({
    fetcher: (async () => Response.json([{
      word: 'flower', phonetic: '/flower/',
      phonetics: [{ text: '/us/', audio: 'https://api.dictionaryapi.dev/media/flower-us.mp3' }],
      meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'the bloom of a plant' }] }],
    }])) as typeof fetch,
    timeout: () => new AbortController().signal,
  });
  const result = await provider('flower', 'en');
  assert.equal(result?.provider, 'Free Dictionary API');
  assert.deepEqual(result?.meanings, [{
    partOfSpeech: 'noun', definitions: [{ definition: 'the bloom of a plant', example: '' }], synonyms: [], antonyms: [],
  }]);
  assert.deepEqual(result?.pronunciations?.map(item => [item.region, item.audio]), [
    ['us', 'https://api.dictionaryapi.dev/media/flower-us.mp3'],
  ]);
});

test('external English adapter distinguishes confirmed not-found from provider failure', async () => {
  const notFound = createFreeDictionaryAdapter({
    fetcher: (async () => new Response(null, { status: 404 })) as typeof fetch,
    timeout: () => new AbortController().signal,
  });
  assert.equal(await notFound('unknown', 'en'), null);

  const unavailable = createFreeDictionaryAdapter({
    fetcher: (async () => { throw new Error('offline'); }) as typeof fetch,
    timeout: () => new AbortController().signal,
  });
  await assert.rejects(unavailable('flower', 'en'), /offline/);
});
