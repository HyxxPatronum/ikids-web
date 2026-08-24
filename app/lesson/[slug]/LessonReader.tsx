'use client';

import { useEffect, useState } from 'react';
import { LookupProvider } from '../../components/Lookup';
import { LookupText } from '../../components/LookupText';
import type { LookupTermAnnotation } from '../../../lib/lookup/text';
import styles from './LessonReader.module.css';

type Paragraph = string | { sentences?: Array<string | { text?: string }> };
type Card = {
  cardId: string;
  courseId?: string;
  title?: string;
  theme?: string;
  topic?: string;
  image?: string;
  image_file?: string;
  paragraphs?: Paragraph[];
  word_bank?: LookupTermAnnotation[];
};

const sentencePattern = /[^.!?]+[.!?]+|[^.!?]+$/g;
const imageSrc = (value: string) => /^(?:https?:|data:|\/)/i.test(value) ? value : `/${value.replace(/^\/+/, '')}`;

function paragraphSentences(paragraph: Paragraph) {
  if (typeof paragraph === 'string') return paragraph.match(sentencePattern) || [paragraph];
  return (paragraph.sentences || []).map(sentence => typeof sentence === 'string' ? sentence : String(sentence.text || ''));
}

function LessonContent({ card, slug }: { card: Card; slug: string }) {
  const image = card.image_file || card.image || '';
  const terms = card.word_bank || [];
  return <main className={styles.shell}>
    <header className={styles.header}><a href="/">Fluent Science Reading</a><nav><a href="/syllabus.html">课程</a><a href="/words">词汇</a></nav></header>
    <article className={styles.lesson}>
      <div className={styles.visual}>{image && <img src={imageSrc(image)} alt={`${card.title || '课程'} 科普图示`} />}</div>
      <div className={styles.copy}>
        <span className="eyebrow">Read the science story</span>
        <h1>{card.title || 'Science Reading'}</h1>
        <div className={styles.meta}>{[card.topic, card.theme].filter(Boolean).join(' · ')}</div>
        <div className={styles.paragraphs} aria-label="课程文章">
          {(card.paragraphs || []).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>
            {paragraphSentences(paragraph).map((sentence, sentenceIndex) => <LookupText
              key={sentenceIndex}
              text={sentence}
              terms={terms}
              courseId={card.cardId || card.courseId || slug}
            />)}
          </p>)}
        </div>
        <div className={styles.actions}><a href={`/index.html?lesson=${encodeURIComponent(slug)}`}>继续完整课程活动</a><a href="/words">打开 Words 中心</a></div>
      </div>
    </article>
  </main>;
}

export default function LessonReader({ slug }: { slug: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cards/${encodeURIComponent(slug)}`)
      .then(async response => { if (!response.ok) throw new Error('课程加载失败'); return response.json() as Promise<Card>; })
      .then(value => { if (!cancelled) setCard(value); })
      .catch(value => { if (!cancelled) setError(value.message); });
    return () => { cancelled = true; };
  }, [slug]);

  if (error) return <main className={styles.shell}><div className={styles.state}><strong>课程暂时无法打开</strong><p>{error}</p></div></main>;
  if (!card) return <main className={styles.shell}><div className={styles.state}>正在加载课程…</div></main>;
  return <LookupProvider><LessonContent card={card} slug={slug} /></LookupProvider>;
}
