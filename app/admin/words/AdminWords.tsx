'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type WordEntry = { english: string; meaning: string; course: string; courseSlug: string };

export default function AdminWords({ words }: { words: WordEntry[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return words;
    return words.filter(w => `${w.english} ${w.meaning}`.toLowerCase().includes(q));
  }, [words, query]);

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>词汇管理</h1>
          <p>全部课程核心词去重汇总，共 {words.length} 个</p>
        </div>
      </div>

      <div className="admin-filters">
        <input className="admin-search" type="search" placeholder="搜索英文或中文释义…" value={query} onChange={e => setQuery(e.target.value)} />
        <span className="muted" style={{ fontSize: 13 }}>{filtered.length} / {words.length}</span>
      </div>

      <div className="panel" style={{ padding: '8px 20px' }}>
        <ul className="admin-def-list">
          {filtered.map(w => (
            <li key={w.english}>
              <span className="word">{w.english}</span>
              <span className="meaning">{w.meaning || '—'}</span>
              <Link className="course" href={`/admin/courses/${w.courseSlug}`}>{w.course} →</Link>
            </li>
          ))}
          {filtered.length === 0 && (
            <li style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>没有匹配的词汇</li>
          )}
        </ul>
      </div>
    </>
  );
}