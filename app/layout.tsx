import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fluent Science Reading',
  description: 'Read · Think · Explain — 儿童英语科普阅读学习平台。',
  openGraph: { title: 'Fluent Science Reading', description: 'Read · Think · Explain — 儿童英语科普阅读学习平台。', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Fluent Science Reading', description: 'Read · Think · Explain — 儿童英语科普阅读学习平台。', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
