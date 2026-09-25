import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LandingLocaleProvider } from '@/components/landing/landing-locale';
import { LandingStory } from './landing-story';
import { StoryController } from './story-controller';
import { BEATS, SCENE_ORDER } from './story-data';
import { STORY_AR } from './story-strings';
import { PausableTimers } from './story-timers';

vi.mock('@/components/dashboard/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

function renderStory(locale: 'en' | 'ar' = 'en') {
  return render(
    <LandingLocaleProvider initialLocale={locale}>
      <LandingStory initialLayout="desk" />
    </LandingLocaleProvider>,
  );
}

describe('the landing story page', () => {
  it('has the five scenes with stable ids, one beat marker per beat and a heading each', { timeout: 30000 }, async () => {
    const { container } = renderStory();
    const ids = ['try', 'store', 'ops', 'product', 'results'];
    SCENE_ORDER.forEach((scene, i) => {
      const section = container.querySelector<HTMLElement>(`section[data-scene="${scene}"]`);
      expect(section, scene).not.toBeNull();
      expect(section!.id).toBe(ids[i]);
      expect(section!.querySelectorAll('[data-beat]')).toHaveLength(BEATS[scene].length);
    });
    /* Scenes after the first load as their own chunks. */
    for (const name of [/A real store/, /Your team and the AI/, /One system, five connected parts/, /Same shopper, every garment/]) {
      /* The first render also pays vitest's transform of each scene module. */
      expect(await screen.findByRole('heading', { level: 2, name }, { timeout: 15000 })).toBeInTheDocument();
    }
  });

  it('points the header scene items at the story scenes and keeps Sign in outside the menu', () => {
    renderStory();
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getByRole('link', { name: 'Try it on' })).toHaveAttribute('href', '/#try');
    expect(nav.getByRole('link', { name: 'Live store' })).toHaveAttribute('href', '/#store');
    expect(nav.getByRole('link', { name: 'AI operations' })).toHaveAttribute('href', '/#ops');
    expect(nav.getByRole('link', { name: 'Product' })).toHaveAttribute('href', '/#product');
    expect(nav.getByRole('link', { name: 'Results' })).toHaveAttribute('href', '/#results');
    expect(nav.getByRole('link', { name: 'How it works' })).toHaveAttribute('href', '/#journey');
    expect(nav.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    const banner = within(screen.getByRole('banner'));
    expect(banner.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/sign-in');
  });

  it('keeps the managed setup promise out of the hero and the operations note until the owner approves it', async () => {
    const { container, unmount } = renderStory('en');
    expect(container.textContent).not.toContain('We set it up and keep it running.');
    expect(container.textContent).not.toContain('Setup, tuning and ongoing care are part of the service.');
    expect(await screen.findByText("Demo data. Order status needs read access to your store's orders.")).toBeInTheDocument();
    unmount();
    const ar = renderStory('ar');
    expect(ar.container.textContent).not.toContain('نحن نجهّز كل شيء ونبقيه يعمل');
    expect(ar.container.textContent).not.toContain('الإعداد والضبط والمتابعة المستمرة');
  });

  it('lets the product tabs and the operations list be used by click', async () => {
    renderStory();
    const report = await screen.findByRole('button', { name: /Report/ });
    fireEvent.click(report);
    expect(report).toHaveAttribute('aria-pressed', 'true');
    const photos = screen.getByRole('button', { name: /Photos read, hard cases handed off/ });
    fireEvent.click(photos);
    expect(photos).toHaveAttribute('aria-pressed', 'true');
  });

  it('has an Arabic translation for every story string', () => {
    for (const [en, ar] of Object.entries(STORY_AR)) {
      expect(ar, en).toBeTruthy();
    }
  });
});

describe('the hero chat script', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('answers the first question on the documented timing, then offers the next questions', () => {
    const c = new StoryController({ layout: 'desk', stacked: false, reduce: false, rtl: false }, 'en');
    c.ask('q1', true);
    expect(c.state.thread.map((m) => m.kind)).toEqual(['user']);
    act(() => void vi.advanceTimersByTime(380));
    expect(c.state.thread.map((m) => m.kind)).toEqual(['user', 'typing']);
    act(() => void vi.advanceTimersByTime(1320));
    expect(c.state.thread.map((m) => m.kind)).toEqual(['user', 'ai']);
    expect(c.state.step).toBe('afterA1');
    expect(c.state.busy).toBe(false);
  });

  it('plays the handoff to the team and ends on Start over', () => {
    const c = new StoryController({ layout: 'desk', stacked: false, reduce: false, rtl: false }, 'ar');
    c.ask('person', false);
    act(() => void vi.advanceTimersByTime(5300));
    expect(c.state.thread.map((m) => m.kind)).toEqual(['user', 'system', 'handoff', 'system', 'team']);
    expect(c.state.thread[4].text).toBe('راجعت المخزون: المقاس M متوفر باللون الأخضر.');
    expect(c.state.step).toBe('done');
    expect(c.state.chatTouched).toBe(true);
  });

  it('never starts on its own once the visitor touched it', () => {
    const c = new StoryController({ layout: 'desk', stacked: false, reduce: false, rtl: false }, 'en');
    c.setChatLang('ar');
    c.startChat();
    expect(c.state.thread).toHaveLength(0);
  });
});

describe('pausable timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds a beat script while the tab is hidden and resumes where it left off', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.later(fn, 1000);
    vi.advanceTimersByTime(400);
    timers.pause();
    vi.advanceTimersByTime(5000);
    expect(fn).not.toHaveBeenCalled();
    timers.resume();
    vi.advanceTimersByTime(599);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('repeats an interval until cleared', () => {
    const timers = new PausableTimers();
    const fn = vi.fn();
    timers.every(fn, 800);
    vi.advanceTimersByTime(2400);
    expect(fn).toHaveBeenCalledTimes(3);
    timers.clear();
    vi.advanceTimersByTime(2400);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
