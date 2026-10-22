import React from 'react';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import { BOOKING_URL } from '@/lib/booking';
import { getPlanCopy } from '@/lib/dashboard/plan-copy';
import { buildPlanView, type PlanFacts } from '@/lib/dashboard/plan-model';
import type { PlanCatalogItem } from '@/lib/try-on/entitlement';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { V16Plan, V16PlanError } from './v16-plan';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-02T12:00:00Z');

const item = (over: Partial<PlanCatalogItem>): PlanCatalogItem => ({
  id: 'g',
  planKey: 'growth-v1',
  name: 'Growth',
  description: null,
  priceMinor: 2900,
  currency: 'USD',
  rendersIncluded: 350,
  modelKey: 'lite',
  periodUnit: 'month',
  periodCount: 1,
  graceDays: 3,
  isFree: false,
  active: true,
  sortOrder: 30,
  ...over,
});

/** 14 looks a day for the last 14 days: 150 left of 350 runs out before the reset. */
function facts(over: Partial<PlanFacts['plan']> = {}): PlanFacts {
  const looks: number[] = [];
  for (let d = 0; d < 14; d++) for (let i = 0; i < 14; i++) looks.push(NOW - d * DAY - (i + 1) * 60_000);
  return {
    now: NOW,
    timeZone: 'Africa/Cairo',
    plan: {
      planKey: 'growth-v1',
      planName: 'Growth',
      status: 'active',
      isFree: false,
      rendersIncluded: 350,
      topUpCreditsRemaining: 0,
      totalCreditsRemaining: 150,
      currentPeriodStart: '2026-09-18T00:00:00Z',
      currentPeriodEnd: '2026-10-18T00:00:00Z',
      available: true,
      ...over,
    },
    plans: [item({ id: 'l', planKey: 'launch-v1', name: 'Launch', priceMinor: 1500, rendersIncluded: 150, sortOrder: 20 }), item({})],
    currency: 'USD',
    looks,
  };
}

function renderPlan(locale: SiteLocale = 'en', over: Partial<PlanFacts['plan']> = {}) {
  return render(<V16Plan view={buildPlanView(facts(over), getPlanCopy(locale), locale)} locale={locale} />);
}

describe('V16Plan', () => {
  it('leads with the looks left, when they run out, and what happens then', () => {
    renderPlan();
    const looks = screen.getByRole('region', { name: 'Try-on looks this cycle' });
    expect(within(looks).getByText('150 left')).toBeInTheDocument();
    expect(within(looks).getByText('of 350, resets 18 October')).toBeInTheDocument();
    expect(within(looks).getByText('Runs out about 13 October')).toBeInTheDocument();
    expect(within(looks).getByText('At this pace, about 14 looks a day, you’ll run out 5 days before the reset.')).toBeInTheDocument();
    expect(within(looks).getByText('The Try it on button hides while you’re out.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'If you run out' })).getByText(/Store Chat keeps working/)).toBeInTheDocument();
  });

  it('draws the cycle as a chart with a table of the numbers, and a meter for phones', () => {
    renderPlan();
    expect(
      screen.getByRole('img', {
        name: 'Looks used this cycle. 196 of 346 looks used by 2 October. At about 14 a day, all 346 are used around 13 October, 5 days before the 18 October reset.',
      }),
    ).toBeInTheDocument();
    // The chart's own labels; the phone meter repeats today's under it.
    const svg = screen.getByRole('img');
    expect(svg).toHaveTextContent('Today, 196 used');
    expect(svg).toHaveTextContent('18 Oct');
    expect(screen.getByText('5 days without try-on')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(15);
    expect(within(table).getAllByRole('row').at(-1)).toHaveTextContent('196');
    expect(screen.getByRole('meter', { name: 'Looks used this cycle' })).toHaveAttribute('aria-valuenow', '196');
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuemax', '346');
  });

  it('answers the keyboard on the chart, from today to the day they run out', () => {
    renderPlan();
    const chart = screen.getByRole('img', { name: /Looks used this cycle/ });
    fireEvent.focus(chart);
    expect(screen.getByRole('status')).toHaveTextContent('2 Oct: 196 looks used so far');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('13 Oct: about 346 at this pace');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(screen.getByRole('status')).toHaveTextContent('1 Oct: 182 looks used');
    fireEvent.blur(chart);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('names the plan, the last three cycles and every plan, with a call to change it', () => {
    renderPlan();
    const yours = screen.getByRole('region', { name: 'Your plan' });
    expect(yours).toHaveTextContent('Growth$29 a month');
    expect(yours).toHaveTextContent('350 looks a month, Store Chat included. Renews on 18 October.');
    expect(within(yours).getByText('Active')).toBeInTheDocument();
    expect(within(yours).getByRole('link', { name: 'Compare plans' })).toHaveAttribute('href', '#plan-list');

    const cycles = screen.getByRole('region', { name: 'Looks used, last 3 cycles' });
    expect(within(cycles).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '18 July to 18 August0',
      '18 August to 18 September0',
      'This cycle so far196',
    ]);
    expect(cycles).toHaveTextContent('Your 350');

    const plans = screen.getByRole('region', { name: 'Plans' });
    expect(within(plans).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Launch$15 a month150 looks a month',
      'GrowthYour plan$29 a month350 looks a month',
    ]);
    for (const link of screen.getAllByRole('link', { name: /Book a call/ })) {
      expect(link).toHaveAttribute('href', BOOKING_URL);
      expect(link).toHaveAttribute('target', '_blank');
    }
  });

  it('says the button is hidden when the plan is not active, and has no chart without a cycle', () => {
    renderPlan('en', { status: 'expired', available: false, currentPeriodStart: null, currentPeriodEnd: null });
    expect(screen.getByText('Plan not active')).toBeInTheDocument();
    expect(screen.queryByText(/At this pace|No looks were made/)).not.toBeInTheDocument();
    expect(screen.getByText('The Try it on button is hidden until the plan is active again.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Looks used, last 3 cycles' })).not.toBeInTheDocument();
  });

  it('speaks Arabic in Arabic, with Western digits', () => {
    const { container } = renderPlan('ar');
    expect(screen.getByRole('region', { name: 'إطلالات التجربة في هذه الدورة' })).toHaveTextContent('150 متبقية');
    expect(screen.getAllByRole('link', { name: /احجز مكالمة/ })).toHaveLength(2);
    expect(container.textContent).not.toMatch(/[٠-٩]/);
  });
});

describe('V16PlanError', () => {
  it('says the plan could not load, in either language', () => {
    const { unmount } = render(<V16PlanError locale="en" />);
    expect(screen.getByRole('status')).toHaveTextContent("Your plan couldn't load just now. Refresh in a minute.");
    unmount();
    render(<V16PlanError locale="ar" />);
    expect(screen.getByRole('status')).toHaveTextContent('تعذّر تحميل باقتك الآن');
  });
});
