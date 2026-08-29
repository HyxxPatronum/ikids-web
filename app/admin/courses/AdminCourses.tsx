'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CardRow } from '@/lib/admin-data';

export default function AdminCourses({ cards, series }: { cards: CardRow[]; series: string[] }) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const [seriesId, setSeriesId] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(card => {
      if (level !== 'all' && card.level !== level) return false;
      if (seriesId !== 'all' && card.seriesId !== seriesId) return false;
      if (q) {
        const haystack = `${card.title} ${card.id} ${card.topic} ${card.theme}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [cards, query, level, seriesId]);

  const levels = [...new Set(cards.map(card => card.level))].sort();

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>课程管理</h1>
          <p>共 {cards.length} 张课程卡片</p>
        </div>
        <Link href="/admin/import" className="btn primary">导入课程</Link>
      </div>

      <div className="admin-filters">
        <input className="admin-search" type="search" placeholder="搜索标题 / ID / 主题…" value={query} onChange={e => setQuery(e.target.value)} />
        <select value={seriesId} onChange={e => setSeriesId(e.target.value)} aria-label="按系列筛选">
          <option value="all">全部系列</option>
          {series.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
        <select value={level} onChange={e => setLevel(e.target.value)} aria-label="按等级筛选">
          <option value="all">全部等级</option>
          {levels.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>系列</th>
              <th className="num">Day</th>
              <th>等级</th>
              <th>主题</th>
              <th className="num">词数</th>
              <th>结构</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(card => (
              <tr key={card.id}>
                <td>
                  <Link href={`/admin/courses/${card.slug}`} style={{ fontWeight: 800, textDecoration: 'none', color: 'var(--blue)' }}>{card.title}</Link>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{card.id}</div>
                </td>
                <td style={{ fontSize: 13 }}>{card.seriesId}</td>
                <td className="num">Day {card.day}</td>
                <td><span className="admin-chip">{card.level}</span></td>
                <td style={{ fontSize: 13 }}>{card.theme}</td>
                <td className="num">{card.wordCount}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{card.structure}</td>
                <td><span className={`badge ${card.status === 'published' ? 'success' : 'warning'}`}>{card.status === 'published' ? '已发布' : '草稿'}</span></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>没有匹配的课程，请调整筛选条件</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}