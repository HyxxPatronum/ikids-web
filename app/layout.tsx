import type { Metadata } from 'next';
import '../styles.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'IKIDs',
  description: '儿童英语科普阅读学习平台。',
  icons: { icon: '/logo-icon.png', apple: '/logo-icon.png' },
  openGraph: { title: 'IKIDs', description: '儿童英语科普阅读学习平台。', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'IKIDs', description: '儿童英语科普阅读学习平台。', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
