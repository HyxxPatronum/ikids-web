import { isApprovedTerm } from '../vocabulary/approval.ts';
import type { ApprovalFields } from '../vocabulary/approval.ts';

export type LookupTermAnnotation = ApprovalFields & {
  english?: string;
};

export type LookupTextPart =
  | { type: 'text'; text: string }
  | {
      type: 'word';
      surfaceForm: string;
      defaultScope: string;
      alternateScopes: string[];
    };

type WordToken = { surfaceForm: string; normalized: string; start: number; end: number };
type Phrase = { normalizedWords: string[]; normalized: string };

const wordPattern = /[A-Za-z]+(?:[’'][A-Za-z]+)*(?:-[A-Za-z]+)*(?:[’'])?/g;
const normalizeWord = (value: string) => value.toLowerCase().replace(/[’‘]/g, "'");

function wordsIn(text: string): WordToken[] {
  return [...text.matchAll(wordPattern)].map(match => ({
    surfaceForm: match[0],
    normalized: normalizeWord(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function approvedPhrases(terms: LookupTermAnnotation[]): Phrase[] {
  const phrases = new Map<string, Phrase>();
  for (const term of terms) {
    if (!isApprovedTerm(term)) continue;
    const normalizedWords = wordsIn(String(term.english || '')).map(word => word.normalized);
    if (normalizedWords.length < 2) continue;
    const normalized = normalizedWords.join(' ');
    phrases.set(normalized, { normalizedWords, normalized });
  }
  return [...phrases.values()].sort((left, right) =>
    right.normalizedWords.length - left.normalizedWords.length || left.normalized.localeCompare(right.normalized));
}

function phraseMatches(text: string, words: WordToken[], start: number, phrase: Phrase) {
  if (start + phrase.normalizedWords.length > words.length) return false;
  return phrase.normalizedWords.every((expected, offset) => {
    const word = words[start + offset];
    if (word.normalized !== expected) return false;
    if (!offset) return true;
    const previous = words[start + offset - 1];
    return /^\s+$/.test(text.slice(previous.end, word.start));
  });
}

export function buildLookupText(text: string, terms: LookupTermAnnotation[] = []): LookupTextPart[] {
  const words = wordsIn(text);
  const matches = new Map<number, { start: number; length: number }>();
  const phrases = approvedPhrases(terms);

  for (let index = 0; index < words.length;) {
    const phrase = phrases.find(candidate => phraseMatches(text, words, index, candidate));
    if (!phrase) {
      index += 1;
      continue;
    }
    for (let offset = 0; offset < phrase.normalizedWords.length; offset += 1) {
      matches.set(index + offset, { start: index, length: phrase.normalizedWords.length });
    }
    index += phrase.normalizedWords.length;
  }

  const parts: LookupTextPart[] = [];
  let cursor = 0;
  words.forEach((word, index) => {
    if (word.start > cursor) parts.push({ type: 'text', text: text.slice(cursor, word.start) });
    const match = matches.get(index);
    if (!match) {
      parts.push({ type: 'word', surfaceForm: word.surfaceForm, defaultScope: word.surfaceForm, alternateScopes: [] });
    } else {
      const phraseWords = words.slice(match.start, match.start + match.length);
      parts.push({
        type: 'word',
        surfaceForm: word.surfaceForm,
        defaultScope: text.slice(phraseWords[0].start, phraseWords.at(-1)!.end),
        alternateScopes: phraseWords.map(item => item.surfaceForm),
      });
    }
    cursor = word.end;
  });
  if (cursor < text.length) parts.push({ type: 'text', text: text.slice(cursor) });
  return parts;
}
