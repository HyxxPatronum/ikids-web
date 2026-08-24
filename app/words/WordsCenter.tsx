'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

type Word = { english: string; meaning?: string; image?: string; category: 'level2' | 'level3' | 'science'; sources?: Array<{ title?: string }> };
type DictionaryResult = {
  word: string; surfaceForm?: string; lexeme?: string; selectedScope?: string; alternateScopes?: string[];
  category?: string; catalogMembership?: string | null; meaning?: string; image?: string; phonetic?: string;
  pronunciations?: Array<{ region: 'us' | 'uk' | 'other'; label?: string; phonetic?: string; audio?: string }>;
  meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition: string; example?: string }> }>;
  provider?: string; cacheStatus?: string; sourceStatus?: { course: string; provider: string }; sources?: Array<{ title?: string; slug?: string }>;
};

type LookupContextValue = { lookup: (term: string, trigger?: HTMLElement | null) => void };
const LookupContext = createContext<LookupContextValue | null>(null);
export const useLookup = () => { const value = useContext(LookupContext); if (!value) throw new Error('useLookup must be used inside LookupProvider'); return value; };

const labels = { level2: ['二级词汇', '小学阶段应掌握的基础词汇'], level3: ['三级词汇', '初中阶段新增的基础词汇'], science: ['Science Core', '来自已发布课程的科学概念'] } as const;

function imageSrc(raw?: string) {
  if (!raw) return '';
  return /^(https?:|data:|\/)/i.test(raw) ? raw : `/${raw.replace(/^\/+/, '')}`;
}

function DictionaryDrawer({ term, trigger, onClose }: { term: string; trigger: HTMLElement | null; onClose: () => void }) {
  const [language, setLanguage] = useState<'en' | 'zh'>(() => typeof window !== 'undefined' && localStorage.getItem('fluent-dictionary-language') === 'zh' ? 'zh' : 'en');
  const [data, setData] = useState<DictionaryResult | null>(null);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(false);
  const [retry, setRetry] = useState(0);
  const drawerRef = useRef<HTMLElement>(null);
  const close = useCallback(() => { onClose(); requestAnimationFrame(() => trigger?.focus()); }, [onClose, trigger]);

  useEffect(() => {
    let cancelled = false;
    setData(null); setError(''); setDetail(false);
    fetch(`/api/dictionary?word=${encodeURIComponent(term)}&lang=${language}`)
      .then(async response => { const body = await response.json() as DictionaryResult & { error?: string }; if (!response.ok) throw new Error(body.error || '查询失败'); return body; })
      .then(value => { if (!cancelled) setData(value); })
      .catch(value => { if (!cancelled) setError(value.message); });
    return () => { cancelled = true; };
  }, [term, language, retry]);

  useEffect(() => {
    drawerRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'Tab') {
        const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,summary') || []);
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [close]);

  const changeLanguage = (next: 'en' | 'zh') => { localStorage.setItem('fluent-dictionary-language', next); setLanguage(next); };
  const common = data?.meanings?.slice(0, detail ? 6 : 1) || [];
  const hasMore = Boolean(data && ((data.meanings?.length || 0) > 1 || data.alternateScopes?.length || data.sources?.length));

  return <div className="react-dictionary-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <aside className="react-dictionary-drawer" ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dictionary-title">
      <header className="react-dictionary-header"><div><span className="eyebrow">Lookup</span><strong id="dictionary-title">词典释义</strong></div><div className="react-dictionary-actions"><div className="react-dictionary-mode" role="tablist" aria-label="词典语言"><button type="button" role="tab" aria-selected={language === 'en'} onClick={() => changeLanguage('en')}>英英</button><button type="button" role="tab" aria-selected={language === 'zh'} onClick={() => changeLanguage('zh')}>英汉</button></div><button className="icon-button" type="button" aria-label="关闭查词结果" onClick={close}>×</button></div></header>
      <div className="react-dictionary-content">
        {error ? <div className="state-box"><strong>查询未完成</strong><span>{error}</span><button className="btn blue" type="button" onClick={() => setRetry(value => value + 1)}>重新查询</button></div> : !data ? <div className="react-dictionary-loading"><h2>{term}</h2><div className="skeleton" /></div> : <>
          <div className="react-dictionary-hero"><div><span className="badge">{data.catalogMembership || '参考词汇'}</span><div className="react-dictionary-word"><h2>{data.selectedScope || data.word}</h2>{data.phonetic && <span>{data.phonetic}</span>}</div><div className="react-pronunciation-row">{(['us', 'uk'] as const).map(region => { const pronunciation = data.pronunciations?.find(item => item.region === region); return <button key={region} className="react-pronunciation" type="button" disabled={!pronunciation?.audio} title={pronunciation?.audio ? `播放${region === 'us' ? '美音' : '英音'}` : '暂无该音频'} onClick={() => pronunciation?.audio && new Audio(pronunciation.audio).play()}><span>◉</span><small>{region === 'us' ? '美音' : '英音'}<b>{pronunciation?.phonetic || '暂无'}</b></small></button>; })}</div></div>{data.image ? <img className="react-dictionary-image" src={imageSrc(data.image)} alt={`${data.word} 相关课程图示`} /> : <div className="react-dictionary-image placeholder">暂无图示</div>}</div>
          {data.meaning && <div className="alert success"><strong>课程释义</strong><br />{data.meaning}</div>}
          {common.length ? <div className="react-meanings">{common.map((group, index) => <section key={`${group.partOfSpeech}-${index}`}><h3>{group.partOfSpeech || 'definition'}</h3>{group.definitions?.map((item, itemIndex) => <div key={itemIndex}><p>{item.definition}</p>{item.example && <small>例：{item.example}</small>}</div>)}</section>)}</div> : <p className="muted">该词已识别，但暂无可显示的释义。</p>}
          {hasMore && <button className="react-more" type="button" onClick={() => setDetail(value => !value)}>{detail ? '收起详情' : `更多信息（${Math.max(0, (data.meanings?.length || 0) - 1)}）`}</button>}
          {detail && data.alternateScopes?.length ? <section className="react-detail-block"><h3>词形与备选范围</h3><p>{data.alternateScopes.join(' · ')}</p></section> : null}
          {detail && data.sources?.length ? <section className="react-detail-block"><h3>课程来源</h3>{data.sources.map((source, index) => source.slug
            ? <a key={index} href={`/lesson/${encodeURIComponent(source.slug)}`}>{source.title || source.slug}</a>
            : <p key={index}>{source.title || '已发布课程'}</p>)}</section> : null}
          {data.cacheStatus === 'stale' && <div className="alert">正在使用已缓存内容，外部词典恢复后会自动更新。</div>}
          <footer className="react-attribution">来源：{data.provider || '本地词库'}{data.lexeme && ` · Lexeme: ${data.lexeme}`}</footer>
        </>}
      </div>
    </aside>
  </div>;
}

export function LookupProvider({ children }: { children: React.ReactNode }) {
  const [lookup, setLookup] = useState<{ term: string; trigger: HTMLElement | null } | null>(null);
  const open = useCallback((term: string, trigger: HTMLElement | null = null) => setLookup({ term, trigger }), []);
  return <LookupContext.Provider value={{ lookup: open }}>{children}{lookup && <DictionaryDrawer term={lookup.term} trigger={lookup.trigger} onClose={() => setLookup(null)} />}</LookupContext.Provider>;
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
