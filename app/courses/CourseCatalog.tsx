'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SiteHeader } from '../components/SiteHeader';
import type { CourseSummary } from '../../lib/course-data';
import { readProgress, type LearningProgress } from '../../lib/local-learning';
import styles from './courses.module.css';

type Filter = 'all' | 'new' | 'learning' | 'done';

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function CourseCatalog({ courses }: { courses: CourseSummary[] }) {
  const [progress, setProgress] = useState<Record<string, LearningProgress>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [seriesOpen, setSeriesOpen] = useState(true);
  const series = useMemo(() => [...new Map(courses.map(course => [course.seriesId, course])).values()], [courses]);
  const [activeSeries, setActiveSeries] = useState(() => series[0]?.seriesId || 'science-reading');
  useEffect(() => setProgress(readProgress()), []);

  const percentage = (course: CourseSummary) => Number(progress[course.id]?.completedPercent || 0);
  const activeCourses = courses.filter(course => course.seriesId === activeSeries);
  const visibleCourses = activeCourses.filter(course => {
    const value = percentage(course);
    return filter === 'all' || filter === 'new' && value === 0 || filter === 'learning' && value > 0 && value < 100 || filter === 'done' && value >= 100;
  });

  /* ── 上次学到哪儿 ── */
  const inProgressEntry = Object.entries(progress)
    .map(([id, p]) => ({ id, ...p }))
    .filter(p => p.completedPercent > 0 && p.completedPercent < 100)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const resumeCourse = inProgressEntry ? courses.find(c => c.id === inProgressEntry.cardId) : null;

  return (
    <>
      <SiteHeader active="courses" />
      <div className={styles.pageBody}>
        <aside className={`panel ${styles.seriesPanel} ${seriesOpen ? '' : styles.panelCollapsed}`}>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={() => setSeriesOpen(v => !v)}
            aria-label={seriesOpen ? '收起课程系列' : '展开课程系列'}
            title={seriesOpen ? '收起课程系列' : '展开课程系列'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={seriesOpen ? 'm14 7-5 5 5 5' : 'm10 7 5 5-5 5'} /></svg>
          </button>
          <div className={styles.seriesContent}>
            <h2 className="section-title">课程系列</h2><p className="muted">选择一个主题路径开始学习。</p>
            <div className={styles.seriesList}>{series.map(item => <button key={item.seriesId} type="button" className={activeSeries === item.seriesId ? styles.seriesActive : ''} onClick={() => { setActiveSeries(item.seriesId); setFilter('all'); }}><strong>{item.seriesId === 'science-reading' ? 'Science Reading' : item.seriesId}</strong><small>{courses.filter(course => course.seriesId === item.seriesId).length}</small></button>)}</div>
            <div className={styles.soonList}>
              {['Physics', 'Chemistry', 'Earth & Space'].map(name => (
                <div key={name} className={styles.soonItem}>
                  <strong>{name}</strong>
                  <small className={styles.soonTag}>Coming Soon</small>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <main className="shell">
        {resumeCourse && (
          <section className={styles.resume}>
            <img src={resumeCourse.imageThumb} alt="" className={styles.resumeImg} />
            <div className={styles.resumeInfo}>
              <p className={styles.resumeEyebrow}>上次学到</p>
              <h3>{resumeCourse.title}</h3>
              <p>Day {String(resumeCourse.day).padStart(3, '0')} · {resumeCourse.level} · 进度 {Math.round(percentage(resumeCourse))}%</p>
            </div>
            <Link className="btn primary" href={`/learn/${encodeURIComponent(resumeCourse.slug)}`}>继续学习 →</Link>
          </section>
        )}
          <section className={`panel ${styles.courseMain}`}>
            <header className={styles.courseHead}>
              <div><h2>{activeSeries === 'science-reading' ? 'Science Reading' : activeSeries}</h2><p className="muted">Nature, life science, and science stories</p></div>
              <span className="badge">{activeCourses.length} lessons</span>
            </header>
            <div className={styles.filters} role="group" aria-label="按学习状态筛选">{([['all', '全部'], ['new', '未开始'], ['learning', '学习中'], ['done', '已完成']] as const).map(([value, label]) => <button key={value} className={filter === value ? styles.active : ''} onClick={() => setFilter(value)} type="button">{label}</button>)}</div>
            <div className={styles.grid}>{visibleCourses.map(course => {
              const value = percentage(course); const label = value >= 100 ? '再次学习' : value > 0 ? '继续学习' : '开始学习';
              return <article key={course.id} className={styles.card}>
                <div className={styles.cardMeta}>DAY {String(course.day).padStart(3, '0')} · {course.level} · {course.theme}</div>
                <img src={course.imageThumb} alt={`${course.title} 阅读卡片`} loading="lazy" className={styles.cardImage} />
                <div className={styles.cardBody}>
                  <div className={styles.cardProgress}>
                    <div className={styles.cardProgressInfo}><span>{value ? `上次学习 ${formatDate(progress[course.id]?.updatedAt)}` : '尚未开始'}</span><strong>{value}%</strong></div>
                    <div className="progress"><span style={{ width: `${value}%` }} /></div>
                  </div>
                  <div className={styles.cardActions}><span className={`badge ${value >= 100 ? 'success' : value > 0 ? 'warning' : ''}`}><span className="status-dot" />{value >= 100 ? '已完成' : value > 0 ? '学习中' : '新课程'}</span><Link className="btn primary" href={`/learn/${encodeURIComponent(course.slug)}`}>{label}</Link></div>
                </div>
              </article>;
            })}{!visibleCourses.length && <div className="state-box"><strong>这个筛选下还没有课程</strong>换一个状态看看，或从未开始的课程出发。</div>}</div>
          </section>
        </main>
      </div>
    </>
  );
}