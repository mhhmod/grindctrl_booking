import { cookies } from 'next/headers';
import Link from 'next/link';
import { getRequestLocale } from '@/lib/auth/locale';
import { getDir } from '@/lib/landing/landing-i18n';

/* Branded 404 so dead links land somewhere on-brand and bilingual instead of
   Next's bare default page. Renders inside the root layout, so fonts, theme,
   and direction all inherit normally. */
const COPY = {
  en: {
    title: 'Page not found',
    body: 'The page you are looking for does not exist or may have moved.',
    home: 'Back to home',
    demo: 'Open the live try-on',
  },
  ar: {
    title: 'الصفحة غير موجودة',
    body: 'الصفحة التي تبحث عنها غير موجودة أو ربما تم نقلها.',
    home: 'العودة إلى الرئيسية',
    demo: 'افتح تجربة الملابس المباشرة',
  },
} as const;

export default async function NotFound() {
  const locale = await getRequestLocale();
  const c = COPY[locale === 'ar' ? 'ar' : 'en'];

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {c.title}
      </h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{c.body}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3" dir={getDir(locale)}>
        <Link
          href="/"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {c.home}
        </Link>
        <Link
          href="/try-on"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {c.demo}
        </Link>
      </div>
    </main>
  );
}
