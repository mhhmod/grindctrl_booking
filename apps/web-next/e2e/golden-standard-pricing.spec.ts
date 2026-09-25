import { test, expect } from '@playwright/test';

/* The v15 pricing page. The catalog comes from the database when the server
   has it and from the built-in fallback otherwise (CI has no secrets), and
   both carry USD and EGP rows, so the currency check holds in either. */

test.describe('pricing page', () => {
  test('the currency toggle switches to EGP and back', async ({ page, context, baseURL }) => {
    await context.clearCookies();
    await context.addCookies([{ name: 'gc-locale', value: 'en', url: baseURL! }]);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/pricing');

    const main = page.locator('main');
    const toEgp = page.getByRole('button', { name: 'Show prices in EGP' });
    await expect(toEgp).toBeVisible();
    await expect(main).toContainText('$');

    await toEgp.click();
    const toUsd = page.getByRole('button', { name: 'Show prices in USD' });
    await expect(toUsd).toBeVisible();
    await expect(main).toContainText('EGP');
    expect(await context.cookies()).toEqual(expect.arrayContaining([expect.objectContaining({ value: 'EGP' })]));

    await toUsd.click();
    await expect(page.getByRole('button', { name: 'Show prices in EGP' })).toBeVisible();
    await expect(main).toContainText('$');
  });

  test('the first question is open and only one opens at a time', async ({ page }) => {
    await page.goto('/pricing');
    const questions = page.locator('button[aria-controls^="faq-a"]');
    const count = await questions.count();
    expect(count).toBeGreaterThan(2);

    await expect(questions.nth(0)).toHaveAttribute('aria-expanded', 'true');
    for (let i = 1; i < count; i += 1) await expect(questions.nth(i)).toHaveAttribute('aria-expanded', 'false');

    await questions.nth(1).click();
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.nth(0)).toHaveAttribute('aria-expanded', 'false');
    const answer = page.locator(`#${await questions.nth(1).getAttribute('aria-controls')}`);
    await expect(answer).toBeVisible();

    await questions.nth(1).click();
    for (let i = 0; i < count; i += 1) await expect(questions.nth(i)).toHaveAttribute('aria-expanded', 'false');
  });

  test('every link and button has a real destination or action', async ({ page }) => {
    await page.goto('/pricing');
    await page.evaluate(() => document.fonts.ready);

    const links = await page.locator('a').evaluateAll((els) =>
      els.map((a) => ({
        href: a.getAttribute('href') ?? '',
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel') ?? '',
        name: (a.getAttribute('aria-label') ?? a.textContent ?? '').trim(),
      })),
    );
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      expect(link.href, `link "${link.name}" has no destination`).toMatch(/^(\/|https?:\/\/|mailto:|#[A-Za-z])/);
      expect(link.href, `link "${link.name}" points nowhere`).not.toBe('#');
      if (link.target === '_blank') expect(link.rel, `link "${link.name}" opens a tab without noopener`).toContain('noopener');
    }

    const buttons = await page.locator('button:visible').evaluateAll((els) =>
      els.map((b) => ({
        name: (b.getAttribute('aria-label') ?? b.textContent ?? '').trim(),
        disabled: (b as HTMLButtonElement).disabled,
      })),
    );
    expect(buttons.length).toBeGreaterThan(3);
    for (const button of buttons) {
      expect(button.name, 'a visible button has no accessible name').not.toBe('');
      expect(button.disabled, `button "${button.name}" is disabled on load`).toBe(false);
    }
  });
});
