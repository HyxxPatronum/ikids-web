import type { DictionaryCache, DictionaryProvider, DictionaryResult } from '../dictionary/service.ts';

type CacheRow = { payload_json: string | null; status: string; expires_at: string };

export function createD1DictionaryCache(db: D1Database, staleTtlMs: number): DictionaryCache {
  return {
    async get(key) {
      const row = await db.prepare('SELECT payload_json,status,expires_at FROM dictionary_cache WHERE word=?').bind(key).first<CacheRow>();
      if (!row) return null;
      const value = row.payload_json ? JSON.parse(row.payload_json) as Partial<DictionaryResult> : null;
      const expiresAt = Date.parse(row.expires_at);
      if (expiresAt > Date.now()) return { value, status: 'hit' };
      if (row.status === 'found' && expiresAt + staleTtlMs > Date.now()) return { value, status: 'stale' };
      await db.prepare('DELETE FROM dictionary_cache WHERE word=?').bind(key).run();
      return null;
    },
    async set(key, value, ttlMs) {
      const now = new Date();
      await db.prepare(
        'INSERT INTO dictionary_cache (word,payload_json,status,expires_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(word) DO UPDATE SET payload_json=excluded.payload_json,status=excluded.status,expires_at=excluded.expires_at,updated_at=excluded.updated_at',
      ).bind(key, value ? JSON.stringify(value) : null, value ? 'found' : 'not_found', new Date(now.getTime() + ttlMs).toISOString(), now.toISOString()).run();
    },
  };
}

const stripMarkup = (value: unknown) => String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

export function createD1EcdictAdapter(db: D1Database): DictionaryProvider {
  return async word => {
    const row = await db.prepare(
      'SELECT word,phonetic,translation,definition,pos,exchange,source FROM dictionary_entries WHERE word=?',
    ).bind(word).first<{ phonetic: string; translation: string }>();
    if (!row) return null;
    const groups = new Map<string, Array<{ definition: string; example: string }>>();
    for (const raw of [...new Set(String(row.translation || '').split(/\\n|\n/))].slice(0, 10)) {
      const line = stripMarkup(raw);
      if (!line) continue;
      const match = line.match(/^([a-z]+(?:\.[a-z]+)*\.)\s*(.+)$/i);
      const partOfSpeech = match?.[1] || '中文释义';
      const definitions = groups.get(partOfSpeech) || [];
      definitions.push({ definition: match?.[2] || line, example: '' });
      groups.set(partOfSpeech, definitions);
    }
    const meanings = [...groups].slice(0, 5).map(([partOfSpeech, definitions]) => ({
      partOfSpeech, definitions: definitions.slice(0, 3), synonyms: [], antonyms: [],
    }));
    return meanings.length ? {
      phonetic: row.phonetic || '', audio: '', meanings, provider: 'ECDICT 本地词典', language: 'zh', lookupSource: 'ecdict',
    } : null;
  };
}
