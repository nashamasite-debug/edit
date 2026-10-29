import type { Metadata } from 'next';
import { Cairo, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-arabic',
});

export const metadata: Metadata = {
  title: 'AI Text Editor Studio',
  description:
    'أداة احترافية لتعديل النصوص داخل الصور والإعلانات بالذكاء الاصطناعي مع الحفاظ على الخطوط والتصميم الأصلي.',
  openGraph: {
    title: 'AI Text Editor Studio',
    description:
      'أداة احترافية لتعديل النصوص داخل الصور والإعلانات بالذكاء الاصطناعي مع الحفاظ على الخطوط والتصميم الأصلي.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Text Editor Studio',
    description:
      'أداة احترافية لتعديل النصوص داخل الصور والإعلانات بالذكاء الاصطناعي مع الحفاظ على الخطوط والتصميم الأصلي.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${ibmPlexArabic.variable}`}
    >
      <body
        suppressHydrationWarning
        style={{
          fontFamily:
            'var(--font-cairo), var(--font-ibm-arabic), sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
