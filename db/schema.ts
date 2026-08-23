import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

