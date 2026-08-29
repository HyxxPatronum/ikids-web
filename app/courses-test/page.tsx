import { Nunito, Noto_Sans_SC } from 'next/font/google';
import { publishedCourses } from '../../lib/course-data';
import CourseCatalogTest from './CourseCatalogTest';

const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito', display: 'swap' });
const notoSansSC = Noto_Sans_SC({ weight: ['400', '500', '700', '800', '900'], subsets: ['latin'], variable: '--font-noto-sc', display: 'swap' });

export const metadata = { title: '课程 · 测试新设计 | IKIDs' };

export default function CoursesTestPage() {
  return (
    <div className={`${nunito.variable} ${notoSansSC.variable}`} style={{ fontFamily: 'var(--font-noto-sc), var(--font-nunito), system-ui, sans-serif' }}>
      <CourseCatalogTest courses={publishedCourses()} />
    </div>
  );
}