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
  tryOnMounted: false,
  testLook: false,
  holdoutAvailable: false,
};

describe('buildTodaySetupView', () => {
  it('m5: a generated look cannot complete the theme step without a mounted button', () => {
    const view = buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-11-12T10:00:00Z', storeLook: true, tryOnMounted: false }, en);
    expect(view.steps[1].done).toBe(false);
    expect(view.current).toBe('theme');
  });

  it.each([en, ar])('M6: pasted stores use setup links and code labels, without Shopify app links', (copy) => {
    const view = buildTodaySetupView({ ...FACTS, platform: 'paste', shop: 'site:11111111-1111-4111-8111-111111111111' }, copy);
    expect(view.addButtonHref).toBe('/dashboard/try-on/setup');
    expect(view.pieces[0]).toMatchObject({ name: copy.chatCode, href: '/dashboard/store#connect' });
    expect(view.pieces[1].name).toBe(copy.tryOnCode);
    expect(view.addButtonHint).toBe(copy.addButtonHintPaste);
    expect(JSON.stringify(view)).not.toContain('/api/shopify/');
  });
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

  it('ticks the theme when its pieces load, before any look is made', () => {
    expect(buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-10-02T10:58:00Z' }, en).steps[1].done).toBe(false);
    expect(buildTodaySetupView({ ...FACTS, tryOnMounted: true }, en).steps[1].done).toBe(false);
    const view = buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-10-02T10:58:00Z', tryOnMounted: true }, en);
    expect(view.steps[1].done).toBe(true);
    expect(view.pieces.map((piece) => [piece.key, piece.ready])).toEqual([
      ['chat', true],
      ['tryOn', true],
    ]);
    expect(view.current).toBe('tryIt');
  });

  it('ticks Try it yourself on a test look, and never Go live', () => {
    const view = buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-10-02T10:58:00Z', tryOnMounted: true, testLook: true }, en);
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
    expect(buildTodaySetupView({ ...FACTS, chatSeenAt: '2026-10-02T10:58:00Z', tryOnMounted: true, testLook: true }, ar).stepsLeft).toBe(
      'تبقّت خطوة واحدة، نحو دقيقتين',
    );
    expect(buildTodaySetupView(FACTS, ar).title).toBe('جهّز Maison Noor للإطلاق');
  });
});

describe('buildTodaySetupView for a WooCommerce store', () => {
  const WOO: TodaySetupFacts = {
    ...FACTS,
    shop: 'site:11111111-1111-4111-8111-111111111111',
    platform: 'woocommerce',
    wpAdmin: { siteEditor: 'https://shop.example.com/wp-admin/site-editor.php', customizer: 'https://shop.example.com/wp-admin/customize.php' },
  };

  it('points at WordPress, names the store, and links no Shopify page', () => {
    const view = buildTodaySetupView(WOO, en);
    expect(view.steps[0].line).toBe('Maison Noor');
    expect(view.addButtonHref).toBe('https://shop.example.com/wp-admin/site-editor.php');
    expect(view.addButtonHint).toBe(en.addButtonHintWoo);
    expect(view.pieces[0]).toMatchObject({ name: en.chatPlugin, href: null });
    expect(JSON.stringify(view)).not.toContain('admin.shopify.com');
  });

  it('falls back to Set up when the paired address cannot be turned into an editor link', () => {
    expect(buildTodaySetupView({ ...WOO, wpAdmin: null }, en).addButtonHref).toBe('/dashboard/try-on/setup');
  });
});
