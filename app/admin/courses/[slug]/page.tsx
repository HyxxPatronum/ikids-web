import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allCourseCards } from '@/lib/admin-data';

export function generateStaticParams() {
  return allCourseCards().map(card => ({ slug: card.slug }));
}

export default async function AdminCourseDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = allCourseCards().find(c => c.slug === slug || c.cardId === slug);
  if (!card) notFound();

  const status = (card as unknown as { status?: string }).status || 'published';
  const comprehension = card.comprehension?.questions ?? [];
  const rebuildSteps = card.rebuild?.steps ?? [];
  const matchPairs = card.wordModule?.matchPairs ?? [];
  const contextQuestions = card.wordModule?.contextQuestions ?? [];
  const sentences = card.listenRead?.sentences ?? [];

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>{card.title}</h1>
          <p>{card.cardId} · Day {card.day} · {card.level} · {card.theme}</p>
        </div>
        <div className="btn-row">
          <span className={`badge ${status === 'published' ? 'success' : 'warning'}`}>{status === 'published' ? '已发布' : '草稿'}</span>
          <Link href={`/learn/${card.slug}`} className="btn blue" target="_blank" rel="noreferrer">预览学习页</Link>
          <Link href="/admin/courses" className="btn ghost">返回列表</Link>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="panel" style={{ padding: 20 }}>
          <div className="admin-section-head"><h2>卡片信息</h2></div>
          <dl className="admin-keyval">
            <div><dt>标题</dt><dd>{card.title}</dd></div>
            <div><dt>Card ID</dt><dd style={{ fontFamily: 'monospace' }}>{card.cardId}</dd></div>
            <div><dt>课程 / 系列</dt><dd>{card.courseId} / {card.seriesId || card.courseId}</dd></div>
            <div><dt>主题</dt><dd>{card.topic} → {card.theme}</dd></div>
            <div><dt>Day / 等级</dt><dd>Day {card.day} · {card.level}</dd></div>
            <div><dt>大问题</dt><dd>{card.bigQuestion || '—'}</dd></div>
            <div><dt>文章结构</dt><dd>{card.articleStructure || card.structure || '—'}</dd></div>
            <div><dt>核心词数</dt><dd>{card.word_bank?.length ?? 0} 个</dd></div>
            <div><dt>状态</dt><dd>{status === 'published' ? '已发布' : '草稿'}</dd></div>
          </dl>
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="admin-section-head"><h2>正文</h2></div>
          <div className="admin-prose">
            {card.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
            {(!card.paragraphs || card.paragraphs.length === 0) && <p className="muted">无正文</p>}
          </div>
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="admin-section-head"><h2>核心词（{card.word_bank?.length ?? 0}）</h2></div>
          <ul className="admin-def-list">
            {(card.word_bank ?? []).map(w => (
              <li key={w.english}>
                <span className="word">{w.english}</span>
                <span className="meaning">{w.chinese || '—'}</span>
              </li>
            ))}
            {(card.word_bank ?? []).length === 0 && <li className="muted">无核心词</li>}
          </ul>
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="admin-section-head"><h2>阅读理解（{comprehension.length} 题）</h2></div>
          <ul className="admin-def-list">
            {comprehension.map((q, i) => (
              <li key={i}>
                <span className="word" style={{ minWidth: 'auto', whiteSpace: 'nowrap' }}>{q.type || 'Q' + (i + 1)}</span>
                <span className="meaning">{q.prompt}<br /><small style={{ color: 'var(--muted)' }}>答案：{q.answer} · {q.options?.[q.answer]}</small></span>
              </li>
            ))}
            {comprehension.length === 0 && <li className="muted">无理解题</li>}
          </ul>
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="admin-section-head"><h2>词义配对 / 语境题</h2></div>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>Match {matchPairs.length} · Context {contextQuestions.length}</p>
          <div className="admin-chips">
            {matchPairs.map(m => <span key={m.word} className="admin-chip">{m.word} → {m.meaning}</span>)}
            {matchPairs.length === 0 && <span className="muted">无配对</span>}
          </div>
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div className="admin-section-head"><h2>结构重建 / 听读</h2></div>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>
            Rebuild 步骤 {rebuildSteps.length} 项 · 听读句子 {sentences.length} 条
          </p>
          <div className="admin-chips">
            {rebuildSteps.map((s, i) => <span key={i} className="admin-chip muted">{i + 1}. {s}</span>)}
            {rebuildSteps.length === 0 && <span className="muted">无重建步骤</span>}
          </div>
        </div>
      </div>
    </>
  );
}