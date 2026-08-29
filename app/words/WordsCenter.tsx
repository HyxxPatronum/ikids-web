'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SiteHeader } from '../components/SiteHeader';
import styles from './words.module.css';

type Word = { english: string; meaning: string; course: string; courseSlug: string };

export default function WordsCenter({ words }: { words: Word[] }) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(36);
  const visible = useMemo(() => words.filter(word => `${word.english} ${word.meaning} ${word.course}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, limit), [words, query, limit]);
  const total = words.filter(word => `${word.english} ${word.meaning} ${word.course}`.toLowerCase().includes(query.trim().toLowerCase())).length;
  return <main className="shell"><SiteHeader active="words" />
    <section className={`panel ${styles.hero}`}><div><h1 className="page-title">每个词，都能回到它的科学语境</h1><p className="muted">浏览当前课程中的核心词，并回到对应课程继续学习。</p></div><label><span>搜索词汇</span><input type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(36); }} placeholder="输入英文单词或中文释义" /></label></section>
    <section className={`panel ${styles.panel}`}><header><div><h2 className="section-title">课程词汇</h2><p className="muted">来自现有 {words.length} 个核心词。</p></div><span className="badge">{query ? `${total} 个匹配` : `${words.length} 词`}</span></header><div className={styles.grid}>{visible.map(word => <article key={`${word.english}-${word.courseSlug}`}><strong>{word.english}</strong><small>{word.meaning || '暂无中文释义'}</small><div><span>{word.course}</span><Link href={`/learn/${word.courseSlug}`}>回到课程</Link></div></article>)}{!visible.length && <div className="state-box"><strong>没有找到匹配词汇</strong>请换一个词或释义试试。</div>}</div>{visible.length < total && <div className={styles.more}><button className="btn" type="button" onClick={() => setLimit(value => value + 36)}>显示更多</button></div>}</section>
  </main>;
}
