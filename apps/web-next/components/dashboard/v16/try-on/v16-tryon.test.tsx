import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getTodayCopy } from '@/lib/dashboard/today-copy';
import { getTryOnResultsCopy } from '@/lib/dashboard/tryon-insights-copy';
import { buildTryOnResultsView, type ResultsJob, type TryOnResultsFacts } from '@/lib/dashboard/tryon-insights-model';
import { V16TryOnResults, V16TryOnResultsError } from './v16-tryon';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const job = (minutesAgo: number, over: Partial<ResultsJob> = {}): ResultsJob => ({
  product_id: 'layla-abaya',
  status: 'completed',
  duration_ms: 14_000,
  message: null,
  created_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
  ...over,
});
const FACTS: TryOnResultsFacts = {
  now: NOW,
  period: 30,
  live: true,
  jobs: [job(5), job(60), job(90, { status: 'failed', message: 'No person detected in the photo' })],
  products: { 'layla-abaya': { title: 'Layla Embroidered Abaya', imageUrl: 'https://cdn.shopify.com/layla.jpg' } },
};

function draw(facts: TryOnResultsFacts, locale: 'en' | 'ar' = 'en') {
  const view = buildTryOnResultsView(facts, getTryOnResultsCopy(locale), getTodayCopy(locale), locale);
  return renderWithMantine(<V16TryOnResults view={view} locale={locale} />);
}

describe('the v16 Try-On Results tab', () => {
  it('shows the tiles, why photos failed, looks by product and the latest looks', () => {
    draw(FACTS);
    expect(screen.getByText('Live on your store')).toBeInTheDocument();
    const tiles = screen.getByRole('region', { name: 'Last 30 days' });
    expect(tiles).toHaveTextContent('Looks made2');
    expect(tiles).toHaveTextContent('67%');

    const why = screen.getByRole('region', { name: "Why some photos didn't make a look" });
    expect(within(why).getByRole('listitem')).toHaveTextContent('1');

    const table = within(screen.getByRole('region', { name: 'By product' })).getByRole('table');
    expect(within(table).getByRole('row', { name: /Layla Embroidered Abaya 2/ })).toBeInTheDocument();

    const recent = within(screen.getByRole('region', { name: 'Recent looks' })).getAllByRole('listitem');
    expect(recent).toHaveLength(3);
    expect(recent[0]).toHaveTextContent('Made in 14 s');
    expect(recent[2]).toHaveTextContent("Didn't work");
    expect(recent[2]).toHaveTextContent('Not counted');
  });

  it('chooses the period from a menu of links', () => {
    draw(FACTS);
    fireEvent.click(screen.getByRole('button', { name: 'Period: Last 30 days' }));
    expect(screen.getByRole('menuitem', { name: 'Last 7 days' })).toHaveAttribute('href', '/dashboard/try-on?period=7');
    expect(screen.getByRole('menuitem', { name: 'Last 90 days' })).toHaveAttribute('href', '/dashboard/try-on?period=90');
  });

  it('says plainly when there are no looks yet, and when the page could not load', () => {
    const { unmount } = draw({ ...FACTS, jobs: [], live: null });
    expect(screen.queryByText('Live on your store')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: "Why some photos didn't make a look" })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'By product' })).toHaveTextContent(getTryOnResultsCopy('en').noLooksYet);
    unmount();

    renderWithMantine(<V16TryOnResultsError locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent("Try-on results couldn't load just now.");
  });

  it('reads in Arabic with Western digits', () => {
    draw(FACTS, 'ar');
    expect(screen.getByRole('link', { name: 'النتائج' })).toHaveAttribute('aria-current', 'page');
    expect(document.body.textContent).toContain('صُنعت في 14 ثانية');
    expect(document.body.textContent).not.toMatch(/[٠-٩]/);
  });
});
