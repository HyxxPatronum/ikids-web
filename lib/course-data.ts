import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type CourseCard = {
  cardId: string; slug: string; courseId: string; seriesId?: string; topic: string; theme: string; day: number; level: string; title: string; bigQuestion?: string; image_file?: string; paragraphs: string[];
  translations?: string[]; paragraphTranslations?: string[];
  word_bank: Array<{ english: string; chinese?: string; image_file?: string; image?: string; illustration?: string }>;
  comprehension: { questions: Array<{ type?: string; prompt: string; options: Record<string, string>; answer: string }> };
  wordModule?: { matchPairs?: Array<{ word: string; meaning: string }>; contextQuestions?: Array<{ prompt: string; options: string[]; answer: string; image_file?: string; image?: string }> };
  articleStructure?: string; structure?: string;
  rebuild?: {
    type?: string;
    steps: string[];
    pairs?: Array<[string, string] | { left?: string; right?: string; feature?: string; function?: string; fact?: string; explanation?: string; cause?: string; effect?: string }>;
  };
  listenRead?: { sentences?: Array<{ sentence: string; role: string }>; fullAudio?: string | null };
  audioDirectory?: string;
};
export type CourseSummary = Pick<CourseCard, 'courseId' | 'topic' | 'theme' | 'day' | 'level' | 'title' | 'image_file'> & { id: string; slug: string; seriesId: string; image: string; imageThumb: string };
const courseDirectory = path.join(process.cwd(), 'lib', 'course');
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const imageUrl = (file?: string) => `/course-images/${encodeURIComponent(path.basename(file || ''))}`;
/** Webp thumbnail URL for the waterfall grid; falls back to the original image URL. */
const imageThumbUrl = (file?: string) => `/course-thumb/${encodeURIComponent(path.basename(file || ''))}`;
const cards: CourseCard[] = readdirSync(courseDirectory).filter(file => file.endsWith('.web-card.json')).sort().map(file => JSON.parse(readFileSync(path.join(courseDirectory, file), 'utf8')) as Omit<CourseCard, 'slug'>).map(card => ({ ...card, slug: slugify(card.cardId || card.title) }));

export function publishedCourses(): CourseSummary[] { return cards.map(card => ({ id: card.cardId, slug: card.slug, courseId: card.courseId, seriesId: card.seriesId || card.courseId, topic: card.topic, theme: card.theme, day: card.day, level: card.level, title: card.title, image_file: card.image_file, image: imageUrl(card.image_file), imageThumb: imageThumbUrl(card.image_file) })).sort((left, right) => left.day - right.day); }
export function courseBySlug(slug: string) { return cards.find(card => card.slug === slug || card.cardId === slug) || null; }
export function courseSummary(slug: string) { return publishedCourses().find(card => card.slug === slug || card.id === slug) || null; }
export const courseSeries = () => [...new Set(cards.map(card => card.seriesId || card.courseId))];
export function courseWordCatalog() { return [...new Map(cards.flatMap(card => card.word_bank.map(word => [word.english.toLowerCase(), { english: word.english, meaning: word.chinese || '', course: card.title, courseSlug: card.slug }]))).values()].sort((left, right) => left.english.localeCompare(right.english)); }
