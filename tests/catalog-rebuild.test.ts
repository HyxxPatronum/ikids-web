import assert from 'node:assert/strict';
import test from 'node:test';
import { rebuildPublishedCatalog, type PublishedCatalogRebuildStore } from '../lib/catalog/rebuild.ts';
import type { PublicationCard, StoredPublicationTerm } from '../lib/catalog/publication-index.ts';

function memoryRebuildStore(initial: StoredPublicationTerm[] = []) {
  let visible = structuredClone(initial);
  let failStage = false;
  const store: PublishedCatalogRebuildStore & { visible(): StoredPublicationTerm[]; failNextStage(): void } = {
    async publishedCards() { return []; },
    async replaceAll(terms) {
      if (failStage) { failStage = false; throw new Error('staging write failed'); }
      visible = structuredClone(terms);
    },
    visible: () => structuredClone(visible),
    failNextStage: () => { failStage = true; },
  };
  return store;
}

const oldTerm: StoredPublicationTerm = {
  lexeme: 'old', english: 'old', meaning: '旧', image: '', illustration: null, pronunciations: [],
  membership: 'science', source: { cardId: 'old-course', slug: 'old-course' },
};

const publishedCard: PublicationCard = {
  cardId: 'course-flower', slug: 'course-flower', status: 'published',
  word_bank: [{ english: 'flower', chinese: '花', approved: true }],
};

test('published Catalog rebuild replaces the complete student-visible snapshot idempotently', async () => {
  const store = memoryRebuildStore([oldTerm]);
  store.publishedCards = async () => [publishedCard];
  assert.deepEqual(await rebuildPublishedCatalog(store), { indexed: 1, courses: 1 });
  assert.deepEqual(store.visible().map(term => term.lexeme), ['flower']);
  assert.deepEqual(await rebuildPublishedCatalog(store), { indexed: 1, courses: 1 });
  assert.deepEqual(store.visible().map(term => term.lexeme), ['flower']);
});

test('a failed Catalog rebuild leaves the prior student-visible snapshot untouched', async () => {
  const store = memoryRebuildStore([oldTerm]);
  store.publishedCards = async () => [publishedCard];
  store.failNextStage();
  await assert.rejects(rebuildPublishedCatalog(store), /staging write failed/);
  assert.deepEqual(store.visible(), [oldTerm]);
});
