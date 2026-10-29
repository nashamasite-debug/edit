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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@300;400;500;600;700;800;900&family=Changa:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Lalezar&family=Noto+Kufi+Arabic:wght@300;400;500;600;700;800;900&family=Readex+Pro:wght@300;400;500;600;700&family=Tajawal:wght@300;400;500;700;800;900&family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
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
