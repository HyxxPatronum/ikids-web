import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { publishedCourses, courseSeries, courseWordCatalog, type CourseCard } from './course-data';

const courseDirectory = path.join(process.cwd(), 'lib', 'course');
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** All card files (including drafts), unlike publishedCourses() which shows everything as published. */
export function allCourseCards(): CourseCard[] {
  return readdirSync(courseDirectory)
    .filter(file => file.endsWith('.web-card.json'))
    .sort()
    .map(file => JSON.parse(readFileSync(path.join(courseDirectory, file), 'utf8')) as Omit<CourseCard, 'slug'>)
    .map(card => ({ ...card, slug: slugify(card.cardId || card.title) }));
}

export type CardRow = {
  id: string;
  slug: string;
  courseId: string;
  seriesId: string;
  topic: string;
  theme: string;
  day: number;
  level: string;
  title: string;
  status: string;
  wordCount: number;
  structure: string;
};

export function cardRows(): CardRow[] {
  return allCourseCards()
    .map(card => ({
      id: card.cardId,
      slug: card.slug,
      courseId: card.courseId,
      seriesId: card.seriesId || card.courseId,
      topic: card.topic,
      theme: card.theme,
      day: card.day,
      level: card.level,
      title: card.title,
      status: (card as unknown as { status?: string }).status || 'published',
      wordCount: card.word_bank?.length ?? 0,
      structure: card.articleStructure || card.structure || '—',
    }))
    .sort((a, b) => a.day - b.day);
}

export type SeriesRow = { id: string; name: string; cardCount: number; topics: number; published: number };

export function seriesRows(): SeriesRow[] {
  const cards = cardRows();
  return courseSeries()
    .map(id => {
      const members = cards.filter(card => (card.seriesId || card.courseId) === id);
      return {
        id,
        name: id === 'science-reading' ? 'Science Reading' : id,
        cardCount: members.length,
        topics: new Set(members.map(card => card.topic)).size,
        published: members.filter(card => card.status === 'published').length,
      };
    })
    .sort((a, b) => b.cardCount - a.cardCount);
}

export type DashboardStats = {
  series: number;
  courses: number;
  published: number;
  drafts: number;
  words: number;
  levels: Record<string, number>;
  structures: Record<string, number>;
};

export function dashboardStats(): DashboardStats {
  const cards = cardRows();
  const words = courseWordCatalog();
  const levels: Record<string, number> = {};
  const structures: Record<string, number> = {};
  for (const card of cards) {
    levels[card.level] = (levels[card.level] ?? 0) + 1;
    const s = card.structure === '—' ? '未标注' : card.structure;
    structures[s] = (structures[s] ?? 0) + 1;
  }
  return {
    series: courseSeries().length,
    courses: cards.length,
    published: cards.filter(card => card.status === 'published').length,
    drafts: cards.filter(card => card.status !== 'published').length,
    words: words.length,
    levels,
    structures,
  };
}

export { publishedCourses, courseSeries, courseWordCatalog, courseBySlug } from './course-data';
