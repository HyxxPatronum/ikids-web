import { createMemoryPublicationStore, createPublicationIndex } from './publication-index.ts';
import type { PublicationCard, StoredPublicationTerm } from './publication-index.ts';

export type PublishedCatalogRebuildStore = {
  publishedCards(): Promise<PublicationCard[]>;
  replaceAll(terms: StoredPublicationTerm[]): Promise<void>;
};

export async function buildPublishedCatalogTerms(cards: PublicationCard[]) {
  const staged = createMemoryPublicationStore();
  const index = createPublicationIndex(staged);
  for (const card of cards) await index.synchronize(card);
  return staged.list();
}

export async function rebuildPublishedCatalog(store: PublishedCatalogRebuildStore) {
  const cards = await store.publishedCards();
  const terms = await buildPublishedCatalogTerms(cards);
  await store.replaceAll(terms);
  return { indexed: terms.length, courses: cards.length };
}
