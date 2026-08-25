import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryPublicationStore, createPublicationIndex, phraseCandidates, reviewPhraseCandidate } from '../lib/catalog/publication-index.ts';
import type { PublicationCard } from '../lib/catalog/publication-index.ts';

test('draft terms remain preview-only and publishing indexes only approved terms', async () => {
  const index = createPublicationIndex(createMemoryPublicationStore());
  const card: PublicationCard = {
    cardId: 'course-life',
    slug: 'course-life',
    title: 'Life Under a Microscope',
    status: 'draft',
    word_bank: [
      { english: 'microscope', chinese: '显微镜', approved: true },
      { english: 'specimen', chinese: '样本', approved: false },
      { english: 'children', chinese: '儿童', approved: true },
    ],
  };

  const preview = index.preview(card);
  assert.deepEqual(preview.map(term => ({ english: term.english, membership: term.membership, studentVisible: term.studentVisible })), [
    { english: 'microscope', membership: 'science', studentVisible: false },
    { english: 'specimen', membership: 'science', studentVisible: false },
    { english: 'children', membership: 'level2', studentVisible: false },
  ]);
  await index.synchronize(card);
  assert.deepEqual(await index.entries(), []);

  await index.synchronize({ ...card, status: 'published' });
  const published = await index.entries();
  assert.deepEqual(published.map(term => [term.lexeme, term.membership]), [
    ['child', 'level2'],
    ['microscope', 'science'],
  ]);
  assert.equal(published.find(term => term.lexeme === 'microscope')?.sources[0]?.slug, 'course-life');
});

test('republishing replaces a course atomically and visibility changes are idempotent', async () => {
  const index = createPublicationIndex(createMemoryPublicationStore());
  const first: PublicationCard = {
    cardId: 'course-a', slug: 'course-a', title: 'Course A', status: 'published',
    word_bank: [{ english: 'microscope', chinese: '显微镜', approved: true }, { english: 'habitat', chinese: '栖息地', approved: true }],
  };
  const second: PublicationCard = {
    cardId: 'course-b', slug: 'course-b', title: 'Course B', status: 'published',
    word_bank: [{ english: 'microscope', chinese: '显微镜', approved: true }],
  };

  await index.synchronize(first);
  await index.synchronize(first);
  await index.synchronize(second);
  assert.deepEqual((await index.lookup('microscope'))[0]?.sources.map(source => source.cardId), ['course-a', 'course-b']);

  await index.synchronize({ ...first, word_bank: [{ english: 'organism', chinese: '生物体', approved: true }] });
  assert.equal((await index.lookup('habitat')).length, 0);
  assert.deepEqual((await index.lookup('microscope'))[0]?.sources.map(source => source.cardId), ['course-b']);
  assert.equal((await index.lookup('organism'))[0]?.meaning, '生物体');

  await index.synchronize({ ...second, status: 'unpublished' });
  await index.synchronize({ ...second, status: 'archived' });
  assert.equal((await index.lookup('microscope')).length, 0);
});

test('course-context lookup chooses the matching published Course Sense deterministically', async () => {
  const index = createPublicationIndex(createMemoryPublicationStore());
  await index.synchronize({
    cardId: 'course-a', status: 'published',
    word_bank: [{ english: 'organism', chinese: 'course A meaning', approved: true }],
  });
  await index.synchronize({
    cardId: 'course-b', status: 'published',
    word_bank: [{ english: 'organism', chinese: 'course B meaning', approved: true }],
  });

  assert.equal((await index.lookup('organism', { courseId: 'course-b' }))[0]?.meaning, 'course B meaning');
});

test('science surface forms share one normalized Lexeme identity', async () => {
  const index = createPublicationIndex(createMemoryPublicationStore());
  await index.synchronize({
    cardId: 'course-plurals', status: 'published',
    word_bank: [{ english: 'microscopes', chinese: '显微镜', approved: true }],
  });
  assert.equal((await index.lookup('microscope'))[0]?.lexeme, 'microscope');
});

test('fixed-catalog membership is decided from the resolved Lexeme', async () => {
  const index = createPublicationIndex(createMemoryPublicationStore());
  await index.synchronize({
    cardId: 'course-flowers', status: 'published',
    word_bank: [{ english: 'flowers', chinese: '花', approved: true }],
  });
  const entry = (await index.lookup('flower'))[0];
  assert.equal(entry?.lexeme, 'flower');
  assert.equal(entry?.membership, 'level2');
});

test('content editors can accept a phrase candidate before publication', () => {
  const card: PublicationCard = {
    cardId: 'course-phrases',
    status: 'draft',
    word_bank: [
      { english: 'living things', chinese: '生物', approvalStatus: 'candidate' },
      { english: 'water cycle', chinese: '水循环', approvalStatus: 'rejected' },
    ],
  };

  assert.deepEqual(phraseCandidates(card).map(term => term.english), ['living things']);
  const reviewed = reviewPhraseCandidate(card, { english: 'living things', action: 'accept' });
  assert.deepEqual(reviewed.word_bank?.[0], {
    english: 'living things',
    chinese: '生物',
    approvalStatus: 'approved',
    approved: true,
  });
});

test('content editors can correct or reject phrase candidates', () => {
  const card: PublicationCard = {
    cardId: 'course-phrase-review',
    status: 'draft',
    word_bank: [
      { english: 'living thing', approvalStatus: 'candidate' },
      { english: 'warm water', approvalStatus: 'candidate' },
    ],
  };

  const corrected = reviewPhraseCandidate(card, {
    english: 'living thing',
    action: 'correct',
    correctedEnglish: 'living things',
  });
  const rejected = reviewPhraseCandidate(corrected, { english: 'warm water', action: 'reject' });
  assert.deepEqual(rejected.word_bank?.map(term => ({
    english: term.english,
    approved: term.approved,
    approvalStatus: term.approvalStatus,
  })), [
    { english: 'living things', approved: true, approvalStatus: 'approved' },
    { english: 'warm water', approved: false, approvalStatus: 'rejected' },
  ]);
  assert.deepEqual(phraseCandidates(rejected), []);
});

test('editor preview carries illustration review state and per-accent pronunciation metadata', async () => {
  const index = createPublicationIndex(createMemoryPublicationStore());
  const card: PublicationCard = {
    cardId: 'course-media', slug: 'course-media', status: 'published', image_file: 'day001-flower.png',
    word_bank: [
      {
        english: 'petals', chinese: '花瓣', approved: true,
        illustration: { src: 'media/petals.png', alt: '张开的花瓣', source: '课程插图库 2024', review: 'approved' },
        pronunciations: [
          { region: 'us', src: 'media/petals-us.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'ready' },
          { region: 'uk', src: 'media/petals-uk.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'pending' },
        ],
      },
      { english: 'soil', chinese: '土壤', approved: true, illustration: { src: 'media/soil.png', alt: '土壤剖面', source: '待审核素材' } },
    ],
  };

  const preview = index.preview(card);
  assert.deepEqual(preview.map(term => [term.english, term.illustration?.review]), [['petals', 'approved'], ['soil', 'pending']]);
  assert.deepEqual(preview[0].pronunciations, [
    { region: 'us', src: 'media/petals-us.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'ready' },
    { region: 'uk', src: 'media/petals-uk.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'pending' },
  ]);
  assert.deepEqual(preview[1].pronunciations, []);

  await index.synchronize(card);
  const entries = await index.entries();
  const petals = entries.find(entry => entry.lexeme === 'petal');
  assert.deepEqual(petals?.illustration, { src: 'media/petals.png', alt: '张开的花瓣', source: '课程插图库 2024', review: 'approved' });
  assert.deepEqual(petals?.pronunciations.map(asset => [asset.region, asset.availability]), [['us', 'ready'], ['uk', 'pending']]);
  assert.equal(entries.find(entry => entry.lexeme === 'soil')?.illustration?.review, 'pending');
});

test('published media keeps the first usable asset when courses share a Lexeme', async () => {
  const index = createPublicationIndex(createMemoryPublicationStore());
  await index.synchronize({
    cardId: 'course-a', slug: 'course-a', status: 'published',
    word_bank: [{ english: 'flower', chinese: '花', approved: true }],
  });
  await index.synchronize({
    cardId: 'course-b', slug: 'course-b', status: 'published',
    word_bank: [{
      english: 'flower', chinese: '花', approved: true,
      illustration: { src: 'media/flower.png', alt: '一朵花', source: '课程插图库', review: 'approved' },
      pronunciations: [{ region: 'uk', src: 'media/flower-uk.mp3', source: '课程录音棚', storage: 'r2:course-audio', availability: 'ready' }],
    }],
  });

  const entry = (await index.lookup('flower'))[0];
  assert.equal(entry?.illustration?.src, 'media/flower.png');
  assert.deepEqual(entry?.pronunciations.map(asset => asset.region), ['uk']);
});
