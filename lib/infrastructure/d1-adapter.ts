import { rebuildPublishedCatalog } from '../catalog/rebuild.ts';
import type { PublishedCatalogRebuildStore } from '../catalog/rebuild.ts';
import type { PublicationCard, StoredPublicationTerm } from '../catalog/publication-index.ts';
import type { ReadinessDependencies } from './health.ts';
import type { ObjectStorage } from './object-storage.ts';

type StateRow = { value: string };
type CountRow = { count: number };
type CardRow = {
  id: string; slug: string; title: string; theme: string; image: string; status: string; content_json: string;
};

const mediaJson = (term: StoredPublicationTerm) => JSON.stringify({
  illustration: term.illustration,
  pronunciations: term.pronunciations,
});

export function createD1PublishedCatalogRebuildStore(db: D1Database): PublishedCatalogRebuildStore {
  return {
    async publishedCards() {
      const rows = await db.prepare(
        "SELECT id,slug,title,theme,image,status,content_json FROM cards WHERE status='published' ORDER BY id",
      ).all<CardRow>();
      return (rows.results || []).map(row => ({
        ...JSON.parse(row.content_json),
        cardId: row.id,
        slug: row.slug,
        title: row.title,
        theme: row.theme,
        image: row.image,
        status: row.status,
      } as PublicationCard));
    },
    async replaceAll(terms) {
      const now = new Date().toISOString();
      await db.batch([
        db.prepare('DELETE FROM published_vocabulary_terms_staging'),
        ...terms.map(term => db.prepare(
          'INSERT INTO published_vocabulary_terms_staging (card_id,lexeme,surface_form,meaning,image,media_json,membership,source_slug,source_title,source_theme,source_image,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        ).bind(
          term.source.cardId, term.lexeme, term.english, term.meaning, term.image, mediaJson(term), term.membership,
          term.source.slug, term.source.title || '', term.source.theme || '', term.source.image || '', now,
        )),
        db.prepare('DELETE FROM published_vocabulary_terms'),
        db.prepare('INSERT INTO published_vocabulary_terms SELECT * FROM published_vocabulary_terms_staging'),
        db.prepare("INSERT INTO infrastructure_state (name,value,updated_at) VALUES ('catalog',?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(String(terms.length), now),
      ]);
    },
  };
}

async function stateValue(db: D1Database, name: string) {
  return db.prepare('SELECT value FROM infrastructure_state WHERE name=?').bind(name).first<StateRow>();
}

export function createD1HealthDependencies(db: D1Database, storage: ObjectStorage): ReadinessDependencies {
  return {
    database: {
      async check() {
        const row = await db.prepare('SELECT 1 AS value').first<{ value: number }>();
        return { ok: row?.value === 1, detail: row?.value === 1 ? 'reachable' : 'database probe failed' };
      },
    },
    ecdict: {
      async check() {
        const state = await stateValue(db, 'ecdict');
        if (!state) return { ok: false, detail: 'ECDICT initialization marker is missing' };
        const [count, required] = await Promise.all([
          db.prepare('SELECT COUNT(*) count FROM dictionary_entries').first<CountRow>(),
          db.prepare('SELECT word FROM dictionary_entries WHERE word=?').bind('flower').first<{ word: string }>(),
        ]);
        const actual = Number(count?.count || 0);
        const expected = Number(state.value || 0);
        const ok = expected > 0 && actual >= expected && required?.word === 'flower';
        return { ok, detail: ok ? `${actual} entries including flower` : 'ECDICT data is incomplete' };
      },
    },
    catalog: {
      async check() {
        const state = await stateValue(db, 'catalog');
        if (!state) return { ok: false, detail: 'Catalog initialization marker is missing' };
        const count = await db.prepare('SELECT COUNT(*) count FROM published_vocabulary_terms').first<CountRow>();
        const actual = Number(count?.count || 0);
        const expected = Number(state.value || 0);
        const ok = actual === expected;
        return { ok, detail: ok ? `${actual} published terms indexed` : `Catalog expected ${expected} terms but found ${actual}` };
      },
    },
    media: {
      async check() {
        const key = `.health/read-write-${crypto.randomUUID()}`;
        const probe = new TextEncoder().encode('ok');
        try {
          await storage.put(key, probe, { contentType: 'application/octet-stream' });
          const stored = await storage.get(key);
          const ok = stored?.size === probe.byteLength;
          return { ok, detail: ok ? 'read/write verified' : 'object storage verification failed' };
        } finally {
          await storage.delete(key);
        }
      },
    },
  };
}

export async function rebuildD1PublishedCatalog(db: D1Database) {
  return rebuildPublishedCatalog(createD1PublishedCatalogRebuildStore(db));
}
