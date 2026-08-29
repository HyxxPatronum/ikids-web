import Link from 'next/link';
import './admin.css';

export const metadata = { title: '内容工作台 | IKIDs' };

const navItems = [
  { href: '/admin', label: '概览', icon: '⊞' },
  { href: '/admin/courses', label: '课程管理', icon: '📄' },
  { href: '/admin/import', label: '数据上传', icon: '⇥' },
  { href: '/admin/words', label: '词汇管理', icon: '📖' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-logo">
          <img src="/logo-icon.png" alt="IKIDs" className="admin-logo-mark" />
          <span className="admin-logo-copy">
            <strong>内容工作台</strong>
            <small>Content Workspace</small>
          </span>
        </Link>
        <nav className="admin-nav">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} className="admin-nav-link">
              <span className="admin-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <Link href="/courses" className="admin-back-link">← 返回前台</Link>
        </div>
      </aside>
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}