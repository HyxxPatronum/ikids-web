import type { CacheStatus, DictionaryCache, DictionaryCatalog, DictionaryProvider, DictionaryResult } from './service.ts';

export function createMemoryProvider(entries: Record<string, Partial<DictionaryResult> | null | Error>): DictionaryProvider {
  return async (lexeme, language) => {
    const value = entries[`${language}:${lexeme}`] ?? entries[lexeme] ?? null;
    if (value instanceof Error) throw value;
    return value;
  };
}

export function createMemoryCache(now: () => number = Date.now): DictionaryCache {
  const values = new Map<string, { value: Partial<DictionaryResult> | null; expiresAt: number; staleUntil: number }>();
  return {
    async get(key) {
      const entry = values.get(key);
      if (!entry) return null;
      if (entry.staleUntil <= now()) { values.delete(key); return null; }
      const status: CacheStatus = entry.expiresAt > now() ? 'hit' : 'stale';
      return { value: entry.value, status };
    },
    async set(key, value, ttlMs, staleTtlMs = 0) {
      const expiresAt = now() + ttlMs;
      values.set(key, { value, expiresAt, staleUntil: expiresAt + staleTtlMs });
    },
  };
}

export function createMemoryCatalog(options: {
  categories?: Record<string, 'level2' | 'level3' | 'science'>;
  courses?: Record<string, ReturnType<DictionaryCatalog['courseFor']>>;
} = {}): DictionaryCatalog {
  return {
    categoryFor: lexeme => options.categories?.[lexeme] || null,
    courseFor: lexeme => options.courses?.[lexeme] || null,
  };
}
