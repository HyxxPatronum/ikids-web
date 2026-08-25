import assert from 'node:assert/strict';
import test from 'node:test';
import { createPronunciationPlayer } from '../lib/pronunciation/playback.ts';
import type { PronunciationPlaybackPort } from '../lib/pronunciation/playback.ts';

type Deferred = { resolve(): void; reject(error?: unknown): void; promise: Promise<void> };
function deferred(): Deferred {
  let resolve!: () => void; let reject!: (error?: unknown) => void;
  const promise = new Promise<void>((onResolve, onReject) => { resolve = () => onResolve(); reject = onReject; });
  return { resolve, reject, promise };
}

const tick = () => new Promise<void>(resolve => setImmediate(resolve));

function createHarness(overrides: Partial<PronunciationPlaybackPort> = {}) {
  const states: string[] = [];
  const audioCalls: string[] = [];
  const speechCalls: string[] = [];
  const stopped: string[] = [];
  const audioFinished = deferred();
  const speechFinished = deferred();
  const port: PronunciationPlaybackPort = {
    async playAudio(url) {
      audioCalls.push(url);
      return { finished: audioFinished.promise, stop: () => stopped.push(`audio:${url}`) };
    },
    async speak(text, region) {
      speechCalls.push(`${region}:${text}`);
      return { finished: speechFinished.promise, stop: () => stopped.push(`speech:${region}`) };
    },
    ...overrides,
  };
  const player = createPronunciationPlayer(port, status => states.push(`${status.region}:${status.state}`));
  return { player, states, audioCalls, speechCalls, stopped, audioFinished, speechFinished };
}

test('a prepared accent recording reports starting then playing then idle', async () => {
  const harness = createHarness();
  const played = harness.player.play({ region: 'us', text: 'flower', audioUrl: '/api/pronunciation?word=flower&region=us' });
  await tick();
  assert.deepEqual(harness.audioCalls, ['/api/pronunciation?word=flower&region=us']);
  harness.audioFinished.resolve();
  await played;
  assert.deepEqual(harness.states, ['us:starting', 'us:playing', 'us:idle']);
  assert.deepEqual(harness.speechCalls, []);
});

test('a failed accent recording falls back to device speech with an explicit fallback state', async () => {
  const harness = createHarness({ playAudio: async () => { throw new Error('audio unavailable'); } });
  const played = harness.player.play({ region: 'uk', text: 'flower', audioUrl: '/api/pronunciation?word=flower&region=uk' });
  await tick();
  harness.speechFinished.resolve();
  await played;
  assert.deepEqual(harness.states, ['uk:starting', 'uk:fallback', 'uk:idle']);
  assert.deepEqual(harness.speechCalls, ['uk:flower']);
});

test('a word without any recording goes straight to device speech fallback', async () => {
  const harness = createHarness();
  const played = harness.player.play({ region: 'us', text: 'unknownword', audioUrl: '' });
  await tick();
  harness.speechFinished.resolve();
  await played;
  assert.deepEqual(harness.audioCalls, []);
  assert.deepEqual(harness.states, ['us:starting', 'us:fallback', 'us:idle']);
});

test('losing both the recording and device speech reports a failed state', async () => {
  const harness = createHarness({
    playAudio: async () => { throw new Error('proxy failed'); },
    speak: async () => { throw new Error('speech synthesis unavailable'); },
  });
  await harness.player.play({ region: 'us', text: 'flower', audioUrl: '/api/pronunciation?word=flower&region=us' });
  assert.deepEqual(harness.states, ['us:starting', 'us:failed']);
});

test('rapid repeat triggers on a playing accent never start overlapping playback', async () => {
  const harness = createHarness();
  const first = harness.player.play({ region: 'us', text: 'flower', audioUrl: '/us.mp3' });
  await tick();
  await harness.player.play({ region: 'us', text: 'flower', audioUrl: '/us.mp3' });
  await harness.player.play({ region: 'us', text: 'flower', audioUrl: '/us.mp3' });
  assert.deepEqual(harness.audioCalls, ['/us.mp3']);
  harness.audioFinished.resolve();
  await first;
  assert.deepEqual(harness.states, ['us:starting', 'us:playing', 'us:idle']);
});

test('switching accents stops the active recording and resets the previous control', async () => {
  const harness = createHarness();
  void harness.player.play({ region: 'us', text: 'flower', audioUrl: '/us.mp3' });
  await tick();
  void harness.player.play({ region: 'uk', text: 'flower', audioUrl: '/uk.mp3' });
  await tick();
  assert.deepEqual(harness.stopped, ['audio:/us.mp3']);
  assert.deepEqual(harness.audioCalls, ['/us.mp3', '/uk.mp3']);
  assert.deepEqual(harness.states, ['us:starting', 'us:playing', 'us:idle', 'uk:starting', 'uk:playing']);
});

test('stopping the player silences active playback', async () => {
  const harness = createHarness();
  void harness.player.play({ region: 'uk', text: 'flower', audioUrl: '/uk.mp3' });
  await tick();
  harness.player.stop();
  assert.deepEqual(harness.stopped, ['audio:/uk.mp3']);
  assert.deepEqual(harness.states.at(-1), 'uk:idle');
});
