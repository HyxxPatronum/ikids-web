import assert from 'node:assert/strict';
import test from 'node:test';
import { courseMediaFor, isPronunciationReady, normalizeIllustration, normalizePronunciationAssets, studentIllustration } from '../lib/media/course-media.ts';

test('an imported Illustration Asset keeps alternative text, provenance, and review status', () => {
  const asset = normalizeIllustration({
    src: 'day001-flower.png',
    alt: '一朵花的花瓣正在展开',
    source: '课程插图库 2024',
    review: 'approved',
  });
  assert.deepEqual(asset, {
    src: 'day001-flower.png',
    alt: '一朵花的花瓣正在展开',
    source: '课程插图库 2024',
    review: 'approved',
  });
  assert.deepEqual(studentIllustration(asset), {
    src: 'day001-flower.png',
    alt: '一朵花的花瓣正在展开',
    source: '课程插图库 2024',
  });
});

test('unreviewed, rejected, alt-less, and remote illustrations stay out of student lookup', () => {
  const legacy = normalizeIllustration('day001-flower.png');
  assert.deepEqual(legacy, { src: 'day001-flower.png', alt: '', source: '', review: 'pending' });
  assert.equal(studentIllustration(legacy), null);
  assert.equal(studentIllustration(normalizeIllustration({ src: 'a.png', alt: '花', review: 'rejected' })), null);
  assert.equal(studentIllustration(normalizeIllustration({ src: 'a.png', alt: '', review: 'approved' })), null);
  assert.equal(normalizeIllustration({ src: 'https://images.example.com/a.png', alt: '花', review: 'approved' }), null);
  assert.equal(normalizeIllustration({ src: '../secrets/a.png', alt: '花', review: 'approved' }), null);
  assert.equal(studentIllustration(null), null);
});

test('US and UK Pronunciation Assets record source, accent, storage, and availability independently', () => {
  const assets = normalizePronunciationAssets({
    us: { src: 'audio/flower-us.mp3', source: '课程录音棚', storage: 'r2:course-audio' },
    uk: { src: 'audio/flower-uk.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'pending' },
  });
  assert.deepEqual(assets, [
    { region: 'us', src: 'audio/flower-us.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'ready' },
    { region: 'uk', src: 'audio/flower-uk.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'pending' },
  ]);
  assert.equal(isPronunciationReady(assets[0]), true);
  assert.equal(isPronunciationReady(assets[1]), false);
});

test('one recording cannot be published under both accent labels', () => {
  const assets = normalizePronunciationAssets([
    { region: 'us', src: 'audio/flower.mp3', source: '课程录音棚' },
    { region: 'uk', src: 'audio/flower.mp3', source: '课程录音棚' },
  ]);
  assert.deepEqual(assets.map(asset => [asset.region, asset.availability]), [['us', 'ready'], ['uk', 'conflict']]);
  assert.equal(assets.filter(isPronunciationReady).length, 1);
});

test('remote or unusable pronunciation locations are never treated as available', () => {
  const assets = normalizePronunciationAssets([
    { region: 'us', src: 'https://audio.example.com/flower.mp3' },
    { region: 'uk', src: '' },
    { region: 'other', src: 'audio/flower.mp3' },
  ]);
  assert.deepEqual(assets.map(asset => [asset.region, asset.availability]), [['us', 'missing'], ['uk', 'missing']]);
  assert.equal(assets.filter(isPronunciationReady).length, 0);
});

test('a Course Term inherits card media and overrides it with its own assets', () => {
  const card = {
    illustration: { src: 'card.png', alt: '课程封面', source: '课程插图库', review: 'approved' },
    image_file: 'card.png',
  };
  const inherited = courseMediaFor({ english: 'roots' }, card);
  assert.deepEqual(inherited.illustration, { src: 'card.png', alt: '课程封面', source: '课程插图库', review: 'approved' });
  assert.deepEqual(inherited.pronunciations, []);

  const overridden = courseMediaFor({
    english: 'bud',
    illustration: { src: 'bud.png', alt: '一个花蕾', source: '课程插图库', review: 'pending' },
    pronunciations: [{ region: 'us', src: 'audio/bud-us.mp3', source: '课程录音棚', storage: 'r2:course-audio' }],
  }, card);
  assert.deepEqual(overridden.illustration, { src: 'bud.png', alt: '一个花蕾', source: '课程插图库', review: 'pending' });
  assert.equal(overridden.pronunciations.length, 1);
});

test('a legacy term image is preserved for editors but stays unreviewed', () => {
  const media = courseMediaFor({ english: 'soil', image: 'soil.png' }, { image_file: 'card.png' });
  assert.deepEqual(media.illustration, { src: 'soil.png', alt: '', source: '', review: 'pending' });
  assert.equal(studentIllustration(media.illustration), null);
});
