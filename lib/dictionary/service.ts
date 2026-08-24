export type DictionaryLanguage = 'en' | 'zh';
export type DictionaryCategory = 'level2' | 'level3' | 'science' | 'reference';
export type CacheStatus = 'hit' | 'miss' | 'stale';

export type DictionaryMeaning = {
  partOfSpeech: string;
  definitions: Array<{ definition: string; example?: string }>;
  synonyms?: string[];
  antonyms?: string[];
};

export type DictionaryPronunciation = {
  region: 'us' | 'uk' | 'other';
  label: string;
  phonetic: string;
  audio: string;
  sourceUrl?: string;
  license?: string;
  licenseUrl?: string;
};

export type DictionaryResult = {
  surfaceForm: string;
  lexeme: string;
  selectedScope: string;
  alternateScopes: string[];
  word: string;
  category: DictionaryCategory;
  catalogMembership: Exclude<DictionaryCategory, 'reference'> | null;
  meaning: string;
  image: string;
  sources: Array<Record<string, unknown>>;
  phonetic: string;
  audio: string;
  pronunciations: DictionaryPronunciation[];
  meanings: DictionaryMeaning[];
  provider: string;
  language: DictionaryLanguage;
  lookupSource: string;
  cacheStatus: CacheStatus;
  sourceStatus: { course: 'found' | 'not_found'; provider: 'found' | 'not_found' | 'unavailable' };
};

export type DictionaryProvider = (lexeme: string, language: DictionaryLanguage) => Promise<Partial<DictionaryResult> | null>;
export type DictionaryCache = {
  get(key: string): Promise<{ value: Partial<DictionaryResult> | null; status: CacheStatus } | null>;
  set(key: string, value: Partial<DictionaryResult> | null, ttlMs: number): Promise<void>;
};

export type DictionaryCatalog = {
  categoryFor(lexeme: string): Exclude<DictionaryCategory, 'reference'> | null;
  courseFor(lexeme: string): { meaning?: string; image?: string; sources?: Array<Record<string, unknown>> } | null;
};

export type DictionaryServiceOptions = {
  provider: DictionaryProvider;
  catalog?: DictionaryCatalog;
  cache?: DictionaryCache;
  now?: () => number;
  ttlMs?: number;
  negativeTtlMs?: number;
};

export const normalizeLookup = (value: unknown): string => String(value ?? '')
  .trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ')
  .replace(/^[^a-z]+|[^a-z]+$/g, '');

export const isValidLookup = (value: string): boolean => value.length > 0 && value.length <= 80
  && /^[a-z]+(?:['-][a-z]+)*(?:\s+[a-z]+(?:['-][a-z]+)*)*$/.test(value);

const irregularLemmas: Record<string, string> = { grew: 'grow', grown: 'grow', went: 'go', gone: 'go', were: 'be', was: 'be', children: 'child', leaves: 'leaf', mice: 'mouse' };
export const resolveLexeme = (value: unknown): string => {
  const normalized = normalizeLookup(value);
  if (irregularLemmas[normalized]) return irregularLemmas[normalized];
  if (normalized.endsWith("'s")) return normalized.slice(0, -2);
  if (normalized.endsWith('ies') && normalized.length > 4) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith('ves') && normalized.length > 4) return `${normalized.slice(0, -3)}f`;
  if (/(?:ches|shes|sses|xes|zes|oes)$/.test(normalized) && normalized.length > 4) return normalized.slice(0, -2);
  if (normalized.endsWith('s') && !normalized.endsWith('ss') && normalized.length > 3) return normalized.slice(0, -1);
  return normalized;
};

function dedupeMeanings(meanings: DictionaryMeaning[]): DictionaryMeaning[] {
  const seen = new Set<string>();
  return meanings.map(group => ({
    ...group,
    definitions: group.definitions.filter(definition => {
      const key = `${group.partOfSpeech}\u0000${definition.definition}\u0000${definition.example || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  })).filter(group => group.definitions.length);
}

export function createDictionaryService(options: DictionaryServiceOptions) {
  const ttlMs = options.ttlMs ?? 7 * 24 * 60 * 60 * 1000;
  const negativeTtlMs = options.negativeTtlMs ?? 30 * 60 * 1000;
  const inflight = new Map<string, Promise<Partial<DictionaryResult> | null>>();

  async function fetchOnce(lexeme: string, language: DictionaryLanguage) {
    const key = `${language}:${lexeme}`;
    const existing = inflight.get(key);
    if (existing) return existing;
    const request = options.provider(lexeme, language).finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  }

  return {
    async lookup(input: unknown, language: DictionaryLanguage = 'en'): Promise<DictionaryResult> {
      const request = typeof input === 'object' && input !== null ? input as { surfaceForm?: unknown; scope?: unknown; language?: DictionaryLanguage; alternateScopes?: unknown[] } : null;
      const surfaceForm = String(request?.surfaceForm ?? input ?? '');
      const selectedScope = normalizeLookup(request?.scope ?? surfaceForm);
      language = request?.language ?? language;
      const lexeme = resolveLexeme(selectedScope);
      if (!['en', 'zh'].includes(language) || !isValidLookup(selectedScope)) {
        throw Object.assign(new Error('Invalid dictionary lookup'), { code: 'INVALID_LOOKUP', status: 400 });
      }
      const course = options.catalog?.courseFor(selectedScope) || options.catalog?.courseFor(lexeme);
      const category = options.catalog?.categoryFor(lexeme) || options.catalog?.categoryFor(selectedScope) || (course ? 'science' : 'reference');
      let remote: Partial<DictionaryResult> | null = null;
      let cacheStatus: CacheStatus = 'miss';
      let hadCache = false;
      let providerStatus: DictionaryResult['sourceStatus']['provider'] = 'not_found';
      if (options.cache) {
        const cached = await options.cache.get(`${language}:${lexeme}`);
        if (cached) { hadCache = true; remote = cached.value; cacheStatus = cached.status; providerStatus = remote ? 'found' : 'not_found'; }
      }
      if (!hadCache || cacheStatus === 'stale') {
        try {
          remote = await fetchOnce(lexeme, language);
          providerStatus = remote ? 'found' : 'not_found';
          if (options.cache) await options.cache.set(`${language}:${lexeme}`, remote, remote ? ttlMs : negativeTtlMs);
        } catch (error) {
          providerStatus = 'unavailable';
          if (!remote && !course && category === 'reference') throw Object.assign(new Error('Dictionary provider unavailable'), { code: 'PROVIDER_UNAVAILABLE', status: 503, cause: error });
          cacheStatus = 'stale';
        }
      }
      if (!remote && !course && category === 'reference') {
        throw Object.assign(new Error('Dictionary entry not found'), { code: 'NOT_FOUND', status: 404 });
      }
      return {
        surfaceForm, lexeme, selectedScope, alternateScopes: (request?.alternateScopes || []).map(normalizeLookup).filter(Boolean),
        word: String(course?.sources?.[0]?.word || selectedScope || lexeme), category, catalogMembership: category === 'reference' ? null : category,
        meaning: course?.meaning || '', image: course?.image || '', sources: course?.sources || [],
        phonetic: remote?.phonetic || '', audio: remote?.audio || '', pronunciations: remote?.pronunciations || [], meanings: dedupeMeanings(remote?.meanings || []), provider: remote?.provider || 'Local dictionary',
        language, lookupSource: remote ? (course || category !== 'reference' ? 'local+provider' : 'provider') : 'local',
        cacheStatus, sourceStatus: { course: course ? 'found' : 'not_found', provider: providerStatus },
      };
    },
  };
}
