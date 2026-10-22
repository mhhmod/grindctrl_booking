import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMantine } from '@/components/mantine/test-utils';
import { getTodayCopy } from '@/lib/dashboard/today-copy';
import { buildTodayView, type TodayFacts } from '@/lib/dashboard/today-model';
import { V16Today } from './v16-today';

const NOW = Date.parse('2026-10-02T11:00:00Z');
const FACTS: TodayFacts = {
  now: NOW,
  timeZone: 'Africa/Cairo',
  canBilling: true,
  tryOn: {
    looksLeft: 140,
    looksIncluded: 350,
    available: true,
    planName: 'Growth',
    planActive: true,
    resetAt: '2026-10-18T11:00:00Z',
    looksLast7: 98,
    looksPrev7: 83,
    looksToday: 14,
  },
  chat: {
    lastSeenAt: new Date(NOW - 2 * 60_000).toISOString(),
    waiting: [
      { since: new Date(NOW - 12 * 60_000).toISOString(), alertSent: true, cart: null },
      { since: new Date(NOW - 3 * 60_000).toISOString(), alertSent: true, cart: null },
    ],
    chatsToday: 18,
    handedOffToday: 2,
    solved7: 120,
    handedOff7: 20,
    handoffs7: 20,
    alertProblems7: 0,
    teamReplyMinutes: 9,
    emailsTeam: true,
  },
};

function draw(facts: TodayFacts, locale: 'en' | 'ar' = 'en') {
  return renderWithMantine(<V16Today view={buildTodayView(facts, getTodayCopy(locale), locale)} locale={locale} />);
}

describe('the v16 Today page', () => {
  it('shows the health strip, what needs the owner with one action each, and the last 7 days', () => {
    draw(FACTS);
    const health = screen.getByRole('region', { name: 'Store health' });
    expect(health).toHaveTextContent('Everything is working');
    expect(health).toHaveTextContent('Store Chat live, seen 2 min ago');

    const needs = screen.getByRole('region', { name: 'Needs you' });
    expect(within(needs).getByText('2 things, most urgent first')).toBeInTheDocument();
    const rows = within(needs).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('2 shoppers are waiting for a person');
    expect(within(rows[0]).getByRole('link', { name: 'Open inbox' })).toHaveAttribute(
      'href',
      '/dashboard/store-chat?tab=conversations',
    );
    expect(rows[1]).toHaveTextContent('Looks run out in about 10 days');
    expect(within(rows[1]).getByRole('link', { name: 'See your plan' })).toHaveAttribute('href', '/dashboard/try-on');

    const week = screen.getByRole('region', { name: 'Last 7 days' });
    expect(week).toHaveTextContent('98');
    expect(week).toHaveTextContent('86%');
    expect(week).toHaveTextContent('9 min');
    // Nothing without a source: no sales, 50/50, Right now or online line.
    expect(screen.queryByText(/Sales with GrindCTRL|50\/50|Right now|is online/)).toBeNull();
  });

  it('says nothing needs the owner on a calm day', () => {
    draw({ ...FACTS, tryOn: { ...FACTS.tryOn!, looksLeft: 300 }, chat: { ...FACTS.chat!, waiting: [], handedOffToday: 0 } });
    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
    const calm = screen.getByRole('region', { name: 'Nothing needs you' });
    expect(calm).toHaveTextContent("The assistant handled all 18 chats today and nobody is waiting. We'll email you if a shopper needs a person.");
    expect(calm).toHaveTextContent('14 looks today');
  });

  it('opens Health details with each check and what is not checked yet', () => {
    draw(FACTS);
    fireEvent.click(screen.getByRole('button', { name: 'Health details' }));
    const dialog = screen.getByRole('dialog', { name: 'Health details' });
    expect(dialog).toHaveTextContent('Showing on your store, 140 looks left of 350.');
    expect(dialog).toHaveTextContent('Every alert in the last 7 days reached your team.');
    expect(dialog).toHaveTextContent('Not checked yet: the theme pieces on every product page, and WhatsApp.');
  });

  it('reads in Arabic', () => {
    draw(FACTS, 'ar');
    expect(screen.getByRole('region', { name: 'حالة المتجر' })).toHaveTextContent('كل شيء يعمل');
    expect(screen.getByRole('heading', { name: 'يحتاجك الآن' })).toBeInTheDocument();
    expect(screen.getByText('متسوقان ينتظران شخصاً من فريقك')).toBeInTheDocument();
  });
});
