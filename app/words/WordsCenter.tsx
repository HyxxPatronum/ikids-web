'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { LookupProvider, useLookup } from '../components/Lookup';

type Word = { english: string; meaning?: string; image?: string; category: 'level2' | 'level3' | 'science'; sources?: Array<{ title?: string }> };

const labels = { level2: ['二级词汇', '小学阶段应掌握的基础词汇'], level3: ['三级词汇', '初中阶段新增的基础词汇'], science: ['Science Core', '来自已发布课程的科学概念'] } as const;

function imageSrc(raw?: string) {
  if (!raw) return '';
  return /^(https?:|data:|\/)/i.test(raw) ? raw : `/${raw.replace(/^\/+/, '')}`;
}

function WordsBrowser() {
  const [words, setWords] = useState<Word[]>([]);
  const [counts, setCounts] = useState({ level2: 505, level3: 1095, science: 0 });
  const [category, setCategory] = useState<Word['category']>('level2');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(36);
  const [loadingError, setLoadingError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch('/api/words').then(async response => { if (!response.ok) throw new Error('词库加载失败'); return response.json() as Promise<{ words?: Word[]; counts?: typeof counts }>; }).then(data => { setWords(data.words || []); setCounts(data.counts || { level2: 505, level3: 1095, science: 0 }); }).catch(error => setLoadingError(error.message)); }, []);
  const visible = useMemo(() => words.filter(word => word.category === category && `${word.english} ${word.meaning || ''}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, limit), [words, category, query, limit]);
  const total = words.filter(word => word.category === category && `${word.english} ${word.meaning || ''}`.toLowerCase().includes(query.trim().toLowerCase())).length;
  const { lookup: open } = useLookup();
  const openLookup = (word: string, event?: React.MouseEvent | KeyboardEvent) => open(word, event?.currentTarget as HTMLElement || null);

  return <main className="react-words-shell"><header className="react-words-header"><a className="react-brand" href="/">Fluent Science Reading <small>Words center</small></a><nav><a href="/syllabus.html">课程</a><a className="active" href="/words">词汇</a><a href="/account.html">账号</a></nav></header><section className="react-words-hero"><div><span className="eyebrow">Vocabulary studio</span><h1>每个词，都能回到它的科学语境</h1><p>浏览课程词汇，或直接查询文章中的任意英文单词。</p></div><form onSubmit={event => { event.preventDefault(); const value = searchRef.current?.value.trim(); if (value) openLookup(value); }}><input ref={searchRef} type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(36); }} placeholder="输入英文单词或短语" aria-label="查询英文词汇" /><button className="btn primary" type="submit">查询</button></form></section><div className="react-category-tabs" role="tablist" aria-label="词汇分类">{(Object.keys(labels) as Word['category'][]).map(id => <button key={id} role="tab" type="button" aria-selected={category === id} onClick={() => { setCategory(id); setLimit(36); }}>{labels[id][0]}<small>{counts[id]} 词</small></button>)}</div><section className="react-word-panel"><header><div><span className="eyebrow">Catalog</span><h2>{labels[category][0]}</h2><p>{labels[category][1]}</p></div><span className="badge">{query ? `${total} 个匹配` : `${counts[category]} 词`}</span></header>{loadingError ? <div className="state-box"><strong>词库加载失败</strong>{loadingError}</div> : <div className="react-word-grid">{visible.map(word => <button key={`${word.category}-${word.english}`} className="react-word-card" type="button" onClick={event => openLookup(word.english, event)}><span className="react-word-media">{word.image ? <img src={imageSrc(word.image)} alt={`${word.english} 相关课程图示`} loading="lazy" /> : <span aria-hidden="true">◇</span>}</span><span><strong>{word.english}</strong><small>{word.meaning || '点击查看释义与发音'}</small></span></button>)}{!visible.length && <div className="state-box"><strong>当前分类没有匹配词汇</strong>尝试输入另一个英文单词或短语。</div>}</div>}{visible.length < total && <div className="react-load-row"><button className="btn" type="button" onClick={() => setLimit(value => value + 36)}>显示更多</button></div>}</section></main>;
}

export default function WordsCenter() { return <LookupProvider><WordsBrowser /></LookupProvider>; }
