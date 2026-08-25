import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPronunciationAudio, PronunciationProxyError } from '../lib/pronunciation/proxy-adapter.ts';

const audioResponse = (body: ArrayBuffer, headers: Record<string, string> = {}) =>
  new Response(body, { headers: { 'content-type': 'audio/mpeg', ...headers } });

const entryWith = (audio: string) => async () => ({ pronunciations: [{ region: 'us' as const, audio }] });
const rejectingFetch = (() => { throw new Error('fetcher must not run'); }) as unknown as typeof fetch;

test('a proxied recording is returned with its media type for an allowed provider', async () => {
  const audio = await loadPronunciationAudio({
    word: 'flower',
    region: 'us',
    resolveEntry: entryWith('https://api.dictionaryapi.dev/media/pronunciations/en/flower-us.mp3'),
    fetcher: (async () => audioResponse(new ArrayBuffer(64))) as unknown as typeof fetch,
  });
  assert.equal(audio.contentType, 'audio/mpeg');
  assert.equal(audio.body.byteLength, 64);
  assert.equal(audio.cacheControl, 'public, max-age=604800');
});

test('an accent without a recording is reported as missing instead of guessed', async () => {
  await assert.rejects(loadPronunciationAudio({
    word: 'flower', region: 'uk',
    resolveEntry: entryWith('https://api.dictionaryapi.dev/media/pronunciations/en/flower-us.mp3'),
    fetcher: rejectingFetch,
  }), (error: PronunciationProxyError) => error.status === 404);
});

test('the audio boundary refuses unlisted hosts and non-https sources', async () => {
  for (const source of ['https://audio.example.com/flower.mp3', 'http://api.dictionaryapi.dev/flower.mp3']) {
    await assert.rejects(loadPronunciationAudio({
      word: 'flower', region: 'us', resolveEntry: entryWith(source), fetcher: rejectingFetch,
    }), (error: PronunciationProxyError) => error.status === 400);
  }
});

test('a malformed recording location never reaches the network', async () => {
  await assert.rejects(loadPronunciationAudio({
    word: 'flower', region: 'us', resolveEntry: entryWith('not a url'), fetcher: rejectingFetch,
  }), (error: PronunciationProxyError) => error.status === 400);
});

test('an allowed provider cannot redirect the proxy to an unlisted target', async () => {
  let redirectMode: RequestRedirect | undefined;
  await assert.rejects(loadPronunciationAudio({
    word: 'flower', region: 'us',
    resolveEntry: entryWith('https://api.dictionaryapi.dev/media/pronunciations/en/flower-us.mp3'),
    fetcher: (async (_input, init) => {
      redirectMode = init?.redirect;
      throw new Error('provider redirect refused');
    }) as typeof fetch,
  }), (error: PronunciationProxyError) => error.status === 504);
  assert.equal(redirectMode, 'error');
});

test('non-audio, failed, and oversized provider responses are rejected', async () => {
  const cases: Array<() => Response> = [
    () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('nope', { status: 500, headers: { 'content-type': 'audio/mpeg' } }),
    () => audioResponse(new ArrayBuffer(8), { 'content-length': '9000000' }),
    () => audioResponse(new ArrayBuffer(5_000_001)),
  ];
  for (const respond of cases) {
    await assert.rejects(loadPronunciationAudio({
      word: 'flower', region: 'us',
      resolveEntry: entryWith('https://ssl.gstatic.com/dictionary/static/sounds/oxford/flower--_us_1.mp3'),
      fetcher: (async () => respond()) as unknown as typeof fetch,
    }), (error: PronunciationProxyError) => error.status === 502);
  }
});

test('an unbounded audio stream is cancelled as soon as it crosses the size limit', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(4_000_000));
    },
    pull(controller) { controller.enqueue(new Uint8Array(1_000_001)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(loadPronunciationAudio({
    word: 'flower', region: 'us',
    resolveEntry: entryWith('https://api.dictionaryapi.dev/media/pronunciations/en/flower-us.mp3'),
    fetcher: (async () => new Response(stream, { headers: { 'content-type': 'audio/mpeg' } })) as unknown as typeof fetch,
  }), (error: PronunciationProxyError) => error.status === 502);
  assert.equal(cancelled, true);
});

test('a provider timeout is reported as an unavailable upstream, not a crash', async () => {
  await assert.rejects(loadPronunciationAudio({
    word: 'flower', region: 'us',
    resolveEntry: entryWith('https://api.dictionaryapi.dev/media/pronunciations/en/flower-us.mp3'),
    fetcher: (async () => { throw Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }); }) as unknown as typeof fetch,
  }), (error: PronunciationProxyError) => error instanceof PronunciationProxyError && error.status === 504);
});
