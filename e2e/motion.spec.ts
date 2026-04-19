import { test, expect, setupPage } from './fixtures';

test.describe('Reduced motion', () => {
  test('animations are disabled when prefers-reduced-motion is reduce', async ({ page }) => {
    // Emulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupPage(page);

    // Check that CSS animations have very short duration
    const animDuration = await page.evaluate(() => {
      const el = document.querySelector('.page-section.active');
      if (!el) return null;
      return getComputedStyle(el).animationDuration;
    });

    // reduced-motion sets animation-duration: 0.01ms
    expect(animDuration).not.toBeNull();
    expect(parseFloat(animDuration!)).toBeLessThanOrEqual(0.02);
  });

  test('scroll-behavior is auto with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupPage(page);

    const scrollBehavior = await page.evaluate(() =>
      getComputedStyle(document.documentElement).scrollBehavior
    );

    expect(scrollBehavior).toBe('auto');
  });

  test('transitions are disabled with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await setupPage(page);

    // With reduced motion, all elements get transition-duration: 0.01ms
    const transitionDuration = await page.evaluate(() =>
      getComputedStyle(document.body).transitionDuration
    );

    expect(parseFloat(transitionDuration)).toBeLessThanOrEqual(0.02);
  });
});
