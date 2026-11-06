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
  it('writes each status beside its platform and gives each a decorative logo in its brand colours', () => {
    const { container } = render(<PlatformRows t={en} />);
    for (const [name, status] of [
      ['WooCommerce', 'Live'],
      ['Your website', 'Live'],
      ['Salla', 'Planned'],
      ['Zid', 'Planned'],
    ] as const) {
      expect(rowOf(container, name), name).toHaveTextContent(name === 'Your website' ? `${name}Store Chat only${status}` : `${name}${status}`);
    }
    // Every row carries a decorative mark; the name and status are the accessible text.
    for (const name of ['WooCommerce', 'Your website', 'Salla', 'Zid']) {
      const mark = rowOf(container, name).querySelector('svg');
      expect(mark, name).not.toBeNull();
      expect(mark).toHaveAttribute('aria-hidden', 'true');
    }
    const fills = (name: string) => Array.from(rowOf(container, name).querySelectorAll('svg, rect, path')).map((el) => el.getAttribute('fill'));
    expect(fills('WooCommerce')).toContain('#873EFF');
    expect(fills('Salla')).toEqual(expect.arrayContaining(['#004956', '#BAF3E6']));
    expect(fills('Zid')).toEqual(expect.arrayContaining(['#AE72FF', '#1F0433']));
  });

  it('words WooCommerce and your website (Store Chat only) as live, never any platform as supported or available', () => {
    const { container } = render(<PlatformRows t={en} />);
    expect(rowOf(container, 'WooCommerce')).toHaveTextContent(/WooCommerce.*Live/);
    expect(rowOf(container, 'Your website')).toHaveTextContent(/Your website.*Store Chat only.*Live/);
    for (const name of ['Salla', 'Zid']) {
      expect(rowOf(container, name).textContent, name).not.toMatch(/\b(live|supported|available|works with)\b/i);
    }
    expect(container.textContent).not.toMatch(/\b(supported|available|works with)\b/i);
  });

  it('translates every name and status', () => {
    const { container } = render(<PlatformRows t={ar} />);
    expect(rowOf(container, 'WooCommerce')).toHaveTextContent('مباشر');
    expect(rowOf(container, 'موقعك')).toHaveTextContent('دردشة المتجر فقط');
    expect(rowOf(container, 'موقعك')).toHaveTextContent('مباشر');
    expect(rowOf(container, 'سلة')).toHaveTextContent('مخطط له');
    expect(rowOf(container, 'زد')).toHaveTextContent('مخطط له');
    expect(container.textContent).not.toMatch(/Your website|In testing|Planned|Live/);
  });

  it.each([
    ['desktop', DeskStack],
    ['phone', PhoneStack],
  ] as const)('shows Shopify as the live connection and the others as labelled chips on the %s stack', (_name, Stack) => {
    const { container } = render(<Stack v={v} t={en} />);
    expect(container.textContent).not.toContain('Your Shopify store');
    expect(container.textContent).toContain('Your store');
    expect(rowOf(container, 'Shopify')).toHaveTextContent('ShopifyLive');
    expect(rowOf(container, 'WooCommerce')).toHaveTextContent('WooCommerceLive');
    expect(rowOf(container, 'Your website')).toHaveTextContent(/Store Chat only.*Live/);
    for (const name of ['Salla', 'Zid']) {
      expect(rowOf(container, name), name).toHaveTextContent('Planned');
    }
    const label = container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('WooCommerce is live for try-on, Store Chat and order status. Your website is live for Store Chat only.');
    expect(label).toContain('Salla and Zid are planned.');
  });
});
