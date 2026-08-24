import { catalogCategory, catalogIdentity, normalizeCatalogValue } from './catalog.ts';
import type { CatalogCard, CatalogCategory } from './catalog.ts';
import { resolveLexeme } from '../dictionary/service.ts';

export type PublicationSource = {
  cardId: string;
  slug: string;
  title?: string;
  theme?: string;
  image?: string;
};

export type StoredPublicationTerm = {
  lexeme: string;
  english: string;
  meaning: string;
  image: string;
  membership: CatalogCategory;
  source: PublicationSource;
};

export type PublishedVocabularyEntry = Omit<StoredPublicationTerm, 'source'> & {
  sources: PublicationSource[];
};

export type PublicationStatus = 'draft' | 'published' | 'unpublished' | 'archived';
export type PublicationCard = Omit<CatalogCard, 'status'> & { cardId: string; status: PublicationStatus };
export type PublicationPreviewTerm = Omit<StoredPublicationTerm, 'source'> & {
  approved: boolean;
  studentVisible: boolean;
};

export type PublicationStore = {
  replaceCourse(cardId: string, terms: StoredPublicationTerm[]): Promise<void>;
  removeCourse(cardId: string): Promise<void>;
  list(): Promise<StoredPublicationTerm[]>;
  find(lexeme: string): Promise<StoredPublicationTerm[]>;
};

function isApproved(term: NonNullable<PublicationCard['word_bank']>[number]) {
  if (term.approved === false) return false;
  if (term.approved === true) return true;
  if (term.approvalStatus) return term.approvalStatus === 'approved';
  return Boolean(term.status && ['approved', 'published'].includes(term.status));
}

function sourceFor(card: PublicationCard): PublicationSource {
  return {
    cardId: card.cardId,
    slug: card.slug || card.cardId,
    title: card.title,
    theme: card.theme,
    image: card.image_file || card.image || '',
  };
}

export const publicationLexeme = (value: unknown) => catalogCategory(value) ? catalogIdentity(value) : resolveLexeme(value);

function aggregate(rows: StoredPublicationTerm[]): PublishedVocabularyEntry[] {
  const entries = new Map<string, PublishedVocabularyEntry>();
  for (const row of rows) {
    const current = entries.get(row.lexeme) || { ...row, sources: [] };
    if (!current.meaning && row.meaning) current.meaning = row.meaning;
    if (!current.image && row.image) current.image = row.image;
    if (!current.sources.some(source => source.cardId === row.source.cardId)) current.sources.push(row.source);
    entries.set(row.lexeme, current);
  }
  return [...entries.values()].sort((left, right) => left.lexeme.localeCompare(right.lexeme));
}

export function createPublicationIndex(store: PublicationStore) {
  const preview = (card: PublicationCard): PublicationPreviewTerm[] => (card.word_bank || []).map(term => {
    const english = String(term.english || '').trim();
    const lexeme = publicationLexeme(english);
    const membership = catalogCategory(lexeme) || catalogCategory(english) || 'science';
    const approved = isApproved(term);
    return {
      lexeme,
      english,
      meaning: term.chinese || term.meaning || '',
      image: term.image || card.image_file || card.image || '',
      membership,
      approved,
      studentVisible: card.status === 'published' && approved,
    };
  }).filter(term => Boolean(normalizeCatalogValue(term.english)));

  return {
    preview,
    async synchronize(card: PublicationCard) {
      if (card.status !== 'published') {
        await store.removeCourse(card.cardId);
        return;
      }
      const source = sourceFor(card);
      const terms = new Map<string, StoredPublicationTerm>();
      for (const item of preview(card).filter(term => term.approved)) {
        const { approved: _approved, studentVisible: _studentVisible, ...term } = item;
        const current = terms.get(term.lexeme);
        terms.set(term.lexeme, current ? {
          ...current,
          meaning: current.meaning || term.meaning,
          image: current.image || term.image,
        } : { ...term, source });
      }
      await store.replaceCourse(card.cardId, [...terms.values()]);
    },
    async entries() { return aggregate(await store.list()); },
    async lookup(value: unknown) { return aggregate(await store.find(publicationLexeme(value))); },
  };
}

export function createMemoryPublicationStore(): PublicationStore {
  const courses = new Map<string, StoredPublicationTerm[]>();
  return {
    async replaceCourse(cardId, terms) { courses.set(cardId, terms.map(term => ({ ...term, source: { ...term.source } }))); },
    async removeCourse(cardId) { courses.delete(cardId); },
    async list() { return [...courses.values()].flat().map(term => ({ ...term, source: { ...term.source } })); },
    async find(lexeme) { return [...courses.values()].flat().filter(term => term.lexeme === lexeme).map(term => ({ ...term, source: { ...term.source } })); },
  };
}
