import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryPublicationStore, createPublicationIndex } from '../lib/catalog/publication-index.ts';
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
