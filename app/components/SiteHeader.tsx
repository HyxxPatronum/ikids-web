import Link from 'next/link';
import styles from './site-header.module.css';

export function SiteHeader({ active, sticky = true }: { active: 'courses' | 'words' | 'admin'; sticky?: boolean }) {
  return (
    <header className={`${styles.header} ${sticky ? '' : styles.headerStatic}`}>
      <div className={styles.inner}>
        {/* ── Logo ── */}
        <Link href="/courses" className={styles.logo}>
          <img src="/logo-icon.png" alt="IKIDs" className={styles.logoIcon} />
          <span className={styles.logoText}>
            IKIDs
          </span>
        </Link>

        {/* ── 主导航（纯文字链接，跟随 logo） ── */}
        <nav className={styles.nav} aria-label="主导航">
          <Link
            href="/courses"
            className={`${styles.navLink} ${active === 'courses' ? styles.navLinkActive : ''}`}
          >
            课程
          </Link>
          <Link
            href="/words"
            className={`${styles.navLink} ${active === 'words' ? styles.navLinkActive : ''}`}
          >
            词汇
          </Link>
        </nav>

        {/* ── 右侧：工作台 + Login/Sign up ── */}
        <div className={styles.actions}>
          <Link
            href="/admin"
            className={`${styles.toolBtn} ${active === 'admin' ? styles.toolBtnActive : ''}`}
            aria-label="工作台"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </Link>
          <Link href="/courses" className={styles.loginBtn}>登录</Link>
          <Link href="/courses" className={styles.signupBtn}>注册</Link>
        </div>

        {/* ── 移动端汉堡菜单 ── */}
        <button type="button" className={styles.hamburger} aria-label="菜单">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </header>
  );
}