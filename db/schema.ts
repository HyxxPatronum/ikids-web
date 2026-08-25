import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const series = sqliteTable('series', {
  id: text('id').primaryKey(), name: text('name').notNull(), subtitle: text('subtitle').notNull().default(''),
  description: text('description').notNull().default(''), sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('draft'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(), slug: text('slug').notNull().unique(), seriesId: text('series_id').notNull(),
  courseId: text('course_id').notNull(), topic: text('topic').notNull(), theme: text('theme').notNull(),
  day: integer('day').notNull(), level: text('level').notNull(), title: text('title').notNull(),
  bigQuestion: text('big_question').notNull().default(''), articleStructure: text('article_structure').notNull(),
  image: text('image').notNull(), contentJson: text('content_json').notNull(), status: text('status').notNull().default('draft'),
  updatedAt: text('updated_at').notNull(),
});

export const learningProgress = sqliteTable('learning_progress', {
  userId: text('user_id').notNull(), cardId: text('card_id').notNull(), payloadJson: text('payload_json').notNull().default('{}'),
  completedPercent: integer('completed_percent').notNull().default(0), updatedAt: text('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.userId, table.cardId] })]);

export const recordingSubmissions = sqliteTable('recording_submissions', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), cardId: text('card_id').notNull(),
  targetSentence: text('target_sentence').notNull(), mime: text('mime'), size: integer('size'),
  status: text('status').notNull().default('uploaded'), createdAt: text('created_at').notNull(),
});

export const dictionaryEntries = sqliteTable('dictionary_entries', {
  word: text('word').primaryKey(), phonetic: text('phonetic').notNull().default(''),
  translation: text('translation').notNull(), definition: text('definition').notNull().default(''),
  pos: text('pos').notNull().default(''), exchange: text('exchange').notNull().default(''),
  source: text('source').notNull().default('ECDICT'), updatedAt: text('updated_at').notNull(),
});

export const dictionaryCache = sqliteTable('dictionary_cache', {
  word: text('word').primaryKey(), payloadJson: text('payload_json'), status: text('status').notNull(),
  expiresAt: text('expires_at').notNull(), updatedAt: text('updated_at').notNull(),
}, table => [index('idx_dictionary_cache_expiry').on(table.expiresAt)]);

export const publishedVocabularyTerms = sqliteTable('published_vocabulary_terms', {
  cardId: text('card_id').notNull(), lexeme: text('lexeme').notNull(), surfaceForm: text('surface_form').notNull(),
  meaning: text('meaning').notNull().default(''), image: text('image').notNull().default(''),
  mediaJson: text('media_json').notNull().default('{}'), membership: text('membership').notNull(), sourceSlug: text('source_slug').notNull(),
  sourceTitle: text('source_title').notNull().default(''), sourceTheme: text('source_theme').notNull().default(''),
  sourceImage: text('source_image').notNull().default(''), updatedAt: text('updated_at').notNull(),
}, table => [
  primaryKey({ columns: [table.cardId, table.lexeme] }),
  index('idx_published_vocabulary_lexeme').on(table.lexeme),
  index('idx_published_vocabulary_membership').on(table.membership, table.lexeme),
]);

export const publishedVocabularyTermsStaging = sqliteTable('published_vocabulary_terms_staging', {
  cardId: text('card_id').notNull(), lexeme: text('lexeme').notNull(), surfaceForm: text('surface_form').notNull(),
  meaning: text('meaning').notNull().default(''), image: text('image').notNull().default(''),
  mediaJson: text('media_json').notNull().default('{}'), membership: text('membership').notNull(), sourceSlug: text('source_slug').notNull(),
  sourceTitle: text('source_title').notNull().default(''), sourceTheme: text('source_theme').notNull().default(''),
  sourceImage: text('source_image').notNull().default(''), updatedAt: text('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.cardId, table.lexeme] })]);

export const infrastructureState = sqliteTable('infrastructure_state', {
  name: text('name').primaryKey(), value: text('value').notNull(), updatedAt: text('updated_at').notNull(),
});
