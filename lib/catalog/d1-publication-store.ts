import type { PublicationStore, StoredPublicationTerm } from './publication-index.ts';
import { normalizeIllustration, normalizePronunciationAssets } from '../media/course-media.ts';

type PublicationRow = {
  card_id: string;
  lexeme: string;
  surface_form: string;
  meaning: string;
  image: string;
  media_json: string;
  membership: StoredPublicationTerm['membership'];
  source_slug: string;
  source_title: string;
  source_theme: string;
  source_image: string;
};

const parseMedia = (value: unknown) => {
  let media: Record<string, unknown> = {};
  try { media = JSON.parse(String(value || '{}')) || {}; } catch { media = {}; }
  return {
    illustration: normalizeIllustration(media.illustration),
    pronunciations: normalizePronunciationAssets(media.pronunciations ?? []),
  };
};

const rowToTerm = (row: PublicationRow): StoredPublicationTerm => ({
  lexeme: row.lexeme,
  english: row.surface_form,
  meaning: row.meaning,
  image: row.image,
  ...parseMedia(row.media_json),
  membership: row.membership,
  source: {
    cardId: row.card_id,
    slug: row.source_slug,
    title: row.source_title,
    theme: row.source_theme,
    image: row.source_image,
  },
});

const selectColumns = 'card_id,lexeme,surface_form,meaning,image,media_json,membership,source_slug,source_title,source_theme,source_image';

export function createD1PublicationStore(db: D1Database): PublicationStore {
  return {
    async replaceCourse(cardId, terms) {
      const now = new Date().toISOString();
      await db.batch([
        db.prepare('DELETE FROM published_vocabulary_terms WHERE card_id=?').bind(cardId),
        ...terms.map(term => db.prepare('INSERT INTO published_vocabulary_terms (card_id,lexeme,surface_form,meaning,image,media_json,membership,source_slug,source_title,source_theme,source_image,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(
          cardId, term.lexeme, term.english, term.meaning, term.image,
          JSON.stringify({ illustration: term.illustration, pronunciations: term.pronunciations }),
          term.membership, term.source.slug,
          term.source.title || '', term.source.theme || '', term.source.image || '', now,
        )),
      ]);
    },
    async removeCourse(cardId) {
      await db.prepare('DELETE FROM published_vocabulary_terms WHERE card_id=?').bind(cardId).run();
    },
    async list() {
      const rows = await db.prepare(`SELECT ${selectColumns} FROM published_vocabulary_terms ORDER BY lexeme,card_id`).all<PublicationRow>();
      return (rows.results || []).map(rowToTerm);
    },
    async find(lexeme) {
      const rows = await db.prepare(`SELECT ${selectColumns} FROM published_vocabulary_terms WHERE lexeme=? ORDER BY card_id`).bind(lexeme).all<PublicationRow>();
      return (rows.results || []).map(rowToTerm);
    },
  };
}
