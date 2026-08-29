import Link from 'next/link';
import { dashboardStats, cardRows, seriesRows } from '@/lib/admin-data';

export default function AdminDashboard() {
  const stats = dashboardStats();
  const cards = cardRows();
  const series = seriesRows();

  return (
    <>
      <div className="admin-header">
        <div>
          <h1>概览</h1>
          <p>内容工作台的数据汇总</p>
        </div>
        <Link href="/admin/import" className="btn primary">导入课程</Link>
      </div>

      <div className="admin-metrics">
        <div className="panel admin-metric">
          <div className="admin-metric-label">系列</div>
          <div className="admin-metric-value">{stats.series}</div>
          <div className="admin-metric-hint">内容系列</div>
        </div>
        <div className="panel admin-metric">
          <div className="admin-metric-label">课程卡片</div>
          <div className="admin-metric-value">{stats.courses}</div>
          <div className="admin-metric-hint">{stats.published} 已发布 · {stats.drafts} 草稿</div>
        </div>
        <div className="panel admin-metric">
          <div className="admin-metric-label">核心词</div>
          <div className="admin-metric-value">{stats.words}</div>
          <div className="admin-metric-hint">全部课程去重后</div>
        </div>
        <div className="panel admin-metric">
          <div className="admin-metric-label">难度等级</div>
          <div className="admin-metric-value">{Object.keys(stats.levels).length}</div>
          <div className="admin-metric-hint">
            {Object.entries(stats.levels).sort().map(([level, count]) => `${level} × ${count}`).join(' · ')}
          </div>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-head">
          <h2>系列</h2>
        </div>
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>系列名称</th>
                <th>ID</th>
                <th className="num">课程数</th>
                <th className="num">主题数</th>
                <th className="num">已发布</th>
              </tr>
            </thead>
            <tbody>
              {series.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 13 }}>{s.id}</td>
                  <td className="num">{s.cardCount}</td>
                  <td className="num">{s.topics}</td>
                  <td className="num"><span className="badge">{s.published}</span></td>
                </tr>
              ))}
              {series.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>暂无系列数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-head">
          <h2>文章结构分布</h2>
        </div>
        <div className="panel" style={{ padding: '16px 20px' }}>
          {Object.keys(stats.structures).length > 0 ? (
            <div className="admin-chips">
              {Object.entries(stats.structures).map(([struct, count]) => (
                <span key={struct} className="admin-chip">{struct} <strong style={{ marginLeft: 4 }}>{count}</strong></span>
              ))}
            </div>
          ) : (
            <span className="muted">暂无数据</span>
          )}
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-head">
          <h2>最近课程</h2>
          <Link href="/admin/courses" className="btn" style={{ fontSize: 13 }}>查看全部</Link>
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
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {cards.slice(0, 10).map(card => (
                <tr key={card.id}>
                  <td><Link href={`/admin/courses/${card.slug}`} style={{ fontWeight: 800, textDecoration: 'none', color: 'var(--blue)' }}>{card.title}</Link></td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{card.seriesId}</td>
                  <td className="num">Day {card.day}</td>
                  <td><span className="admin-chip">{card.level}</span></td>
                  <td style={{ fontSize: 13 }}>{card.theme}</td>
                  <td><span className={`badge ${card.status === 'published' ? 'success' : 'warning'}`}>{card.status === 'published' ? '已发布' : '草稿'}</span></td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>暂无课程数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}