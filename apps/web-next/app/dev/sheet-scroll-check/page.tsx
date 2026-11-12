import { notFound } from 'next/navigation';
import type { Viewport } from 'next';
import { SheetScrollCheck } from './sheet-scroll-check';
import { isFixtureState } from './fixtures';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, interactiveWidget: 'resizes-content' };

export default async function Page({ searchParams }: {
  searchParams: Promise<{ state?: string; locale?: string; long?: string; theme?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  return <SheetScrollCheck state={isFixtureState(params.state) ? params.state : 'photo'}
    locale={params.locale === 'ar' ? 'ar' : 'en'} long={params.long === '1'} dark={params.theme === 'dark'} />;
}
