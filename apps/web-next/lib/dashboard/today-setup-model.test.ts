import { describe, expect, it } from 'vitest';
import { getTodaySetupCopy } from './today-setup-copy';
import { buildTodaySetupView, MINUTES_PER_STEP, type TodaySetupFacts } from './today-setup-model';

const en = getTodaySetupCopy('en');
const ar = getTodaySetupCopy('ar');
const FACTS: TodaySetupFacts = {
  store: 'Maison Noor',
  shop: 'maison-noor.myshopify.com',
  chatSeenAt: null,
  storeLook: false,
  testLook: false,
  holdoutAvailable: false,
};

describe('buildTodaySetupView', () => {
  it('starts on the theme with the store connected', () => {
    const view = buildTodaySetupView(FACTS, en);
    expect(view.steps.map((step) => [step.key, step.done])).toEqual([
      ['connected', true],
      ['theme', false],
      ['tryIt', false],
      ['goLive', false],
    ]);
    expect(view.current).toBe('theme');
    expect(view.stepsLeft).toBe(`3 steps left, about ${3 * MINUTES_PER_STEP} minutes`);
    expect(view.progress).toBe(25);
    expect(view.steps[0].line).toBe('maison-noor.myshopify.com');
  });

  it('ticks the theme only once Store Chat has loaded and a look was started on the store', () => {
    expect(buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-10-02T10:58:00Z' }, en).steps[1].done).toBe(false);
    expect(buildTodaySetupView({ ...FACTS, storeLook: true }, en).steps[1].done).toBe(false);
    const view = buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-10-02T10:58:00Z', storeLook: true }, en);
    expect(view.steps[1].done).toBe(true);
    expect(view.pieces.map((piece) => [piece.key, piece.ready])).toEqual([
      ['chat', true],
      ['tryOn', true],
    ]);
    expect(view.current).toBe('tryIt');
  });

  it('ticks Try it yourself on a test look, and never Go live', () => {
    const view = buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-10-02T10:58:00Z', storeLook: true, testLook: true }, en);
    expect(view.current).toBe('goLive');
    expect(view.stepsLeft).toBe('1 step left, about 2 minutes');
    expect(view.progress).toBe(75);
  });

  it('links each piece where it is turned on', () => {
    const view = buildTodaySetupView(FACTS, en);
    expect(view.pieces[0].href).toBe('/api/shopify/theme-link?shop=maison-noor.myshopify.com&block=messenger&mode=embed');
    expect(view.pieces[1].href).toBeNull();
    expect(view.addButtonHref).toBe('/api/shopify/theme-link?shop=maison-noor.myshopify.com&block=tryon&mode=product');
  });

  it('counts steps and minutes in Arabic', () => {
    expect(buildTodaySetupView(FACTS, ar).stepsLeft).toBe('تبقّت 3 خطوات، نحو 6 دقائق');
    expect(buildTodaySetupView({ ...FACTS, testLook: true }, ar).stepsLeft).toBe('تبقّت خطوتان، نحو 4 دقائق');
    expect(buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-10-02T10:58:00Z', storeLook: true, testLook: true }, ar).stepsLeft).toBe(
      'تبقّت خطوة واحدة، نحو دقيقتين',
    );
    expect(buildTodaySetupView(FACTS, ar).title).toBe('جهّز Maison Noor للإطلاق');
  });
});
