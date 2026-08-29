'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SiteHeader } from '../components/SiteHeader';
import type { CourseSummary } from '../../lib/course-data';
import { readProgress, type LearningProgress } from '../../lib/local-learning';
import styles from './courses-test.module.css';

type Filter = 'all' | 'new' | 'learning' | 'done';

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

export default function CourseCatalogTest({ courses }: { courses: CourseSummary[] }) {
  const [progress, setProgress] = useState<Record<string, LearningProgress>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const series = useMemo(() => [...new Map(courses.map(c => [c.seriesId, c])).values()], [courses]);
  const [activeSeries, setActiveSeries] = useState(() => series[0]?.seriesId || 'science-reading');
  useEffect(() => setProgress(readProgress()), []);

  const percentage = (course: CourseSummary) => Number(progress[course.id]?.completedPercent || 0);
  const activeCourses = courses.filter(c => c.seriesId === activeSeries);
  const visibleCourses = activeCourses.filter(c => {
    const v = percentage(c);
    return filter === 'all' || filter === 'new' && v === 0 || filter === 'learning' && v > 0 && v < 100 || filter === 'done' && v >= 100;
  });

  const records = Object.values(progress);

  /* ── 上次学到哪儿了 ── */
  const inProgressEntry = Object.entries(progress)
    .map(([id, p]) => ({ id, ...p }))
    .filter(p => p.completedPercent > 0 && p.completedPercent < 100)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const resumeCourse = inProgressEntry ? courses.find(c => c.id === inProgressEntry.cardId) : null;

  return (
    <>
      <SiteHeader active="courses" />
      <main className="shell">
        {/* ── 继续学习快捷入口 ── */}
      {resumeCourse && (
        <section className={styles.resume}>
          <img
            src={resumeCourse.image}
            alt=""
            className={styles.resumeImg}
          />
          <div className={styles.resumeInfo}>
            <p className={styles.resumeEyebrow}>上次学到</p>
            <h3>{resumeCourse.title}</h3>
            <p>Day {String(resumeCourse.day).padStart(3, '0')} · {resumeCourse.level} · 进度 {Math.round(percentage(resumeCourse))}%</p>
          </div>
          <Link className="btn primary" href={`/learn/${encodeURIComponent(resumeCourse.slug)}`}>
            继续学习 →
          </Link>
        </section>
      )}

      {/* ── 系列侧栏 + 卡片网格 ── */}
      <div className={styles.catalog}>
        <aside className={`panel ${styles.seriesPanel}`}>
          <h2 className="section-title">课程系列</h2>
          <p className="muted">选择一个主题路径开始学习。</p>
          <div className={styles.seriesList}>
            {series.map(item => (
              <button
                key={item.seriesId}
                type="button"
                className={activeSeries === item.seriesId ? styles.seriesActive : ''}
                onClick={() => { setActiveSeries(item.seriesId); setFilter('all'); }}
              >
                <strong>{item.seriesId === 'science-reading' ? 'Science Reading' : item.seriesId}</strong>
                <small>{courses.filter(c => c.seriesId === item.seriesId).length} lessons</small>
              </button>
            ))}
          </div>
        </aside>
        <section className={`panel ${styles.courseMain}`}>
        <header className={styles.mainHead}>
          <div>
            <h2 className="section-title">{activeSeries === 'science-reading' ? 'Science Reading' : activeSeries}</h2>
            <p className="muted">Nature, life science, and science stories</p>
          </div>
          <span className="badge">{activeCourses.length} lessons</span>
        </header>

        <div className={styles.filters} role="group" aria-label="按学习状态筛选">
          {([['all', '全部'], ['new', '未开始'], ['learning', '学习中'], ['done', '已完成']] as const).map(([value, label]) => (
            <button key={value} className={filter === value ? styles.filterActive : ''} onClick={() => setFilter(value)} type="button">
              {label}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {visibleCourses.map(course => {
            const value = percentage(course);
            const label = value >= 100 ? '再次学习' : value > 0 ? '继续学习' : '开始学习';
            return (
              <article key={course.id} className={styles.card}>
                <div className={styles.cardMeta}>
                  DAY {String(course.day).padStart(3, '0')} · {course.level} · {course.theme}
                </div>
                <img
                  src={course.imageThumb}
                  alt={`${course.title} 阅读卡片`}
                  loading="lazy"
                  className={styles.cardImage}
                />
                <div className={styles.cardBody}>
                  <div className={styles.cardProgress}>
                    <div className={styles.cardProgressInfo}>
                      <span>{value ? `上次学习 ${formatDate(progress[course.id]?.updatedAt)}` : '尚未开始'}</span>
                      <strong>{value}%</strong>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${value}%` }} />
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <span className={`badge ${value >= 100 ? 'success' : value > 0 ? 'warning' : ''}`}>
                      <span className="status-dot" />
                      {value >= 100 ? '已完成' : value > 0 ? '学习中' : '新课程'}
                    </span>
                    <Link className="btn primary" href={`/learn/${encodeURIComponent(course.slug)}`}>
                      {label}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
          {!visibleCourses.length && (
            <div className="state-box" style={{ gridColumn: '1 / -1' }}>
              <strong>这个筛选下还没有课程</strong>
              换一个状态看看，或从未开始的课程出发。
            </div>
          )}
        </div>
        </section>
      </div>
      </main>
    </>
  );
}