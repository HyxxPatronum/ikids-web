import level2Data from '../../data/vocabulary-level2.json' with { type: 'json' };
import level3Data from '../../data/vocabulary-level3.json' with { type: 'json' };
import type { ApprovalFields } from '../vocabulary/approval.ts';

const level2Words = level2Data as string[];
const level3Words = level3Data as string[];

export type CatalogCategory = 'level2' | 'level3' | 'science';
export type CatalogCard = {
  cardId?: string;
  slug?: string;
  title?: string;
  theme?: string;
  image?: string;
  image_file?: string;
  status?: string;
  illustration?: unknown;
  word_bank?: Array<{ english?: string; chinese?: string; meaning?: string; image?: string; illustration?: unknown; pronunciations?: unknown } & ApprovalFields>;
};

export type CatalogIndexEntry = {
  english: string;
  meaning?: string;
  image?: string;
  membership: CatalogCategory;
  sources?: Array<Record<string, unknown>>;
};

export const normalizeCatalogValue = (value: unknown) => String(value || '').trim().toLowerCase()
  .replace(/[’]/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, '');

function aliasesForEntry(entry: string) {
  const match = entry.match(/^([^()]+?)(?:\s*\(([^)]*)\))?$/);
  const aliases = new Set<string>();
  (match?.[1] || entry).split(/\s*\/\s*/).map(normalizeCatalogValue).filter(Boolean).forEach(value => aliases.add(value));
  const note = (match?.[2] || '').trim();
  if (note) {
    const variants = /\bAmE\b/i.test(note) ? note.split(/\bAmE\b/i) : note.split(',');
    variants.map(value => normalizeCatalogValue(value.replace(/^pl\.\s*/i, '').replace(/^=\s*/, '')))
      .filter(Boolean).forEach(value => aliases.add(value));
  }
  return [...aliases];
}

function identityMap(entries: string[], excluded = new Set<string>()) {
  const identities = new Map<string, string>();
  for (const entry of entries) {
    const aliases = aliasesForEntry(entry);
    const identity = aliases[0];
    if (!identity) continue;
    for (const alias of aliases) if (!excluded.has(alias)) identities.set(alias, identity);
  }
  return identities;
}

const level2Identities = identityMap(level2Words);
const level2Aliases = new Set(level2Identities.keys());
const level3Identities = identityMap(level3Words, level2Aliases);
const level3Aliases = new Set(level3Identities.keys());

export function catalogIdentity(value: unknown): string {
  const normalized = normalizeCatalogValue(value);
  return level2Identities.get(normalized) || level3Identities.get(normalized) || normalized;
}

export function catalogCategory(value: unknown): CatalogCategory | null {
  const normalized = normalizeCatalogValue(value);
  return level2Aliases.has(normalized) ? 'level2' : level3Aliases.has(normalized) ? 'level3' : null;
}

const cardSlug = (card: CatalogCard) => card.slug || `${String(card.cardId || 'course').toLowerCase()}`;

type CatalogWord = {
  english: string;
  meaning: string;
  image?: string;
  category: CatalogCategory;
  sources: Array<Record<string, unknown>>;
};

function assembleCatalog(science: CatalogWord[]) {
  const level2: CatalogWord[] = level2Words.map(english => ({ english, meaning: '', category: 'level2', sources: [] }));
  const level3: CatalogWord[] = level3Words.map(english => ({ english, meaning: '', category: 'level3', sources: [] }));
  return {
    words: [...level2, ...level3, ...science],
    counts: { level2: level2.length, level3: level3.length, science: science.length },
  };
}

export function buildCatalog(cards: CatalogCard[]) {
  const science = new Map<string, any>();
  for (const card of cards) for (const term of card.word_bank || []) {
    const key = normalizeCatalogValue(term.english);
    if (!key || catalogCategory(key)) continue;
    const entry = science.get(key) || {
      english: term.english,
      meaning: term.chinese || term.meaning || '',
      image: term.image || card.image_file || card.image || '',
      category: 'science' as const,
      sources: [],
    };
    if (!entry.meaning) entry.meaning = term.chinese || term.meaning || '';
    if (!entry.image) entry.image = term.image || card.image_file || card.image || '';
    if (card.status === 'published') {
      const source = { cardId: card.cardId, slug: cardSlug(card), title: card.title, theme: card.theme, image: card.image_file || card.image || '' };
      if (!entry.sources.some((item: any) => item.cardId === source.cardId)) entry.sources.push(source);
    }
    science.set(key, entry);
  }
  const scienceWords = [...science.values()].filter(entry => entry.sources.length).sort((a, b) => a.english.localeCompare(b.english));
  return assembleCatalog(scienceWords);
}

export function buildCatalogFromIndex(entries: CatalogIndexEntry[]) {
  const science: CatalogWord[] = entries.filter(entry => entry.membership === 'science' && !catalogCategory(entry.english)).map(entry => ({
    english: entry.english,
    meaning: entry.meaning || '',
    image: entry.image || '',
    category: 'science',
    sources: entry.sources || [],
  }));
  return assembleCatalog(science);
}

export const catalogStats = {
  level2: level2Words.length,
  level3: level3Words.length,
  overlap: level2Words.filter(word => level3Words.includes(word)).length,
};
