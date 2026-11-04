import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlatformRows } from './platform-rows';
import { STORY_AR } from './story-strings';
import type { StoryT, V } from './story-types';
import { DeskStack } from './views/desk-stack';
import { PhoneStack } from './views/phone-stack';

const en: StoryT = (text) => text;
const ar: StoryT = (text) => STORY_AR[text];
const v = {} as V;

/** The row that holds a platform's visible name, found by that name. */
function rowOf(container: HTMLElement, name: string): HTMLElement {
  const label = Array.from(container.querySelectorAll('span')).find((el) => el.textContent === name);
  if (!label) throw new Error(`no row for ${name}`);
  return label.closest('div') as HTMLElement;
}

describe('the platform rows of the stack scene', () => {
  it('writes each status beside its platform and gives it a mark only where an official one exists', () => {
    const { container } = render(<PlatformRows t={en} />);
    for (const [name, status] of [
      ['WooCommerce', 'Store Chat onlyLive'],
      ['Your website', 'In testing'],
      ['Salla', 'Planned'],
      ['Zid', 'Planned'],
    ] as const) {
      expect(rowOf(container, name), name).toHaveTextContent(`${name}${status}`);
    }
    // Zid has no official mark, so its row shows the name alone. The others
    // carry a decorative mark; the name and status are the accessible text.
    expect(rowOf(container, 'Zid').querySelector('svg')).toBeNull();
    for (const name of ['WooCommerce', 'Your website', 'Salla']) {
      const mark = rowOf(container, name).querySelector('svg');
      expect(mark, name).not.toBeNull();
      expect(mark).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('words only WooCommerce as live, and only for Store Chat, never any platform as supported or available', () => {
    const { container } = render(<PlatformRows t={en} />);
    expect(rowOf(container, 'WooCommerce')).toHaveTextContent(/Store Chat only.*Live/);
    for (const name of ['Your website', 'Salla', 'Zid']) {
      expect(rowOf(container, name).textContent, name).not.toMatch(/\b(live|supported|available|works with)\b/i);
    }
    expect(container.textContent).not.toMatch(/\b(supported|available|works with)\b/i);
  });

  it('translates every name and status', () => {
    const { container } = render(<PlatformRows t={ar} />);
    expect(rowOf(container, 'WooCommerce')).toHaveTextContent('دردشة المتجر فقط');
    expect(rowOf(container, 'WooCommerce')).toHaveTextContent('مباشر');
    expect(rowOf(container, 'موقعك')).toHaveTextContent('قيد الاختبار');
    expect(rowOf(container, 'سلة')).toHaveTextContent('مخطط له');
    expect(rowOf(container, 'زد')).toHaveTextContent('مخطط له');
    expect(container.textContent).not.toMatch(/Your website|In testing|Planned|Store Chat only|Live/);
  });

  it.each([
    ['desktop', DeskStack],
    ['phone', PhoneStack],
  ] as const)('shows Shopify as the live connection and the others as labelled chips on the %s stack', (_name, Stack) => {
    const { container } = render(<Stack v={v} t={en} />);
    expect(container.textContent).not.toContain('Your Shopify store');
    expect(container.textContent).toContain('Your store');
    expect(rowOf(container, 'Shopify')).toHaveTextContent('ShopifyLive');
    expect(rowOf(container, 'WooCommerce')).toHaveTextContent('WooCommerceStore Chat onlyLive');
    for (const name of ['Your website', 'Salla', 'Zid']) {
      expect(rowOf(container, name), name).toHaveTextContent(/In testing|Planned/);
    }
    const label = container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('WooCommerce is live for Store Chat only. Your website is in testing, for Store Chat only.');
    expect(label).toContain('Salla and Zid are planned.');
  });
});
