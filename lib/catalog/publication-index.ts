import { catalogCategory, catalogIdentity, normalizeCatalogValue } from './catalog.ts';
import type { CatalogCard, CatalogCategory } from './catalog.ts';
import { resolveLexeme } from '../dictionary/service.ts';
import { courseMediaFor } from '../media/course-media.ts';
import type { IllustrationAsset, PronunciationAsset } from '../media/course-media.ts';
import { isApprovedTerm } from '../vocabulary/approval.ts';

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
  illustration: IllustrationAsset | null;
  pronunciations: PronunciationAsset[];
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

type PhraseTerm = NonNullable<PublicationCard['word_bank']>[number];
export type PhraseReview = {
  english: string;
  action: 'accept' | 'correct' | 'reject';
  correctedEnglish?: string;
};

const isPhrase = (value: unknown) => normalizeCatalogValue(value).includes(' ');

export function phraseCandidates(card: PublicationCard): PhraseTerm[] {
  return (card.word_bank || []).filter(term => isPhrase(term.english)
    && !isApprovedTerm(term)
    && term.approvalStatus !== 'rejected');
}

export function reviewPhraseCandidate(card: PublicationCard, review: PhraseReview): PublicationCard {
  const target = normalizeCatalogValue(review.english);
  const correctedEnglish = String(review.correctedEnglish || '').trim();
  if (review.action === 'correct' && !isPhrase(correctedEnglish)) {
    throw new Error('A corrected phrase must contain at least two words');
  }
  let found = false;
  const word_bank: PhraseTerm[] = (card.word_bank || []).map(term => {
    if (normalizeCatalogValue(term.english) !== target) return { ...term };
    found = true;
    if (review.action === 'reject') return { ...term, approved: false, approvalStatus: 'rejected' as const };
    return {
      ...term,
      english: review.action === 'correct' ? correctedEnglish : term.english,
      approved: true,
      approvalStatus: 'approved' as const,
    };
  });
  if (!found) throw new Error('Phrase candidate not found');
  return {
    ...card,
    word_bank,
  };
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
    if (!current.illustration && row.illustration) current.illustration = row.illustration;
    if (!current.pronunciations.length && row.pronunciations.length) current.pronunciations = row.pronunciations;
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
    const approved = isApprovedTerm(term);
    const media = courseMediaFor(term as Record<string, unknown>, card as Record<string, unknown>);
    return {
      lexeme,
      english,
      meaning: term.chinese || term.meaning || '',
      image: term.image || card.image_file || card.image || '',
      illustration: media.illustration,
      pronunciations: media.pronunciations,
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
          illustration: current.illustration || term.illustration,
          pronunciations: current.pronunciations.length ? current.pronunciations : term.pronunciations,
        } : { ...term, source });
      }
      await store.replaceCourse(card.cardId, [...terms.values()]);
    },
    async entries() { return aggregate(await store.list()); },
    async lookup(value: unknown, context?: { courseId?: string }) {
      const rows = await store.find(publicationLexeme(value));
      if (context?.courseId) rows.sort((left, right) =>
        Number(right.source.cardId === context.courseId) - Number(left.source.cardId === context.courseId));
      return aggregate(rows);
    },
  };
}

export function createMemoryPublicationStore(): PublicationStore {
  const courses = new Map<string, StoredPublicationTerm[]>();
  const clone = (term: StoredPublicationTerm): StoredPublicationTerm => ({
    ...term,
    illustration: term.illustration ? { ...term.illustration } : null,
    pronunciations: term.pronunciations.map(asset => ({ ...asset })),
    source: { ...term.source },
  });
  return {
    async replaceCourse(cardId, terms) { courses.set(cardId, terms.map(clone)); },
    async removeCourse(cardId) { courses.delete(cardId); },
    async list() { return [...courses.values()].flat().map(clone); },
    async find(lexeme) { return [...courses.values()].flat().filter(term => term.lexeme === lexeme).map(clone); },
  };
}
