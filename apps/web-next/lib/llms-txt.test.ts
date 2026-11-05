// @vitest-environment node
import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { BOOKING_URL } from '@/lib/booking';
import { buildLlmsTxt, LLMS_PAGES } from './llms-txt';
import { findPublicIntegration } from './product-truth/public-integrations';

const ORIGIN = 'https://grindctrl.cloud';
const text = buildLlmsTxt(ORIGIN);
const lineFor = (name: string) => {
  const line = text.split('\n').find((candidate) => candidate.startsWith(`- ${name}:`));
  if (!line) throw new Error(`no platform line for ${name}`);
  return line;
};

describe('llms.txt', () => {
  it('describes the product in llmstxt.org shape: a title, a summary and sections', () => {
    const lines = text.split('\n');
    expect(lines[0]).toBe('# GRINDCTRL');
    expect(lines[2]).toMatch(/^> GRINDCTRL gives fashion stores AI virtual try-on and an AI Store Chat/);
    expect(text).toContain('## Platform status');
    expect(text).toContain('## Pages');
  });

  it('states the honest status of every platform, read from the register', () => {
    expect(lineFor('Shopify')).toMatch(/^- Shopify: Live\. /);
    expect(lineFor('WooCommerce')).toMatch(/^- WooCommerce: Live\. Try-On, Store Chat and order status, through the GRINDCTRL WordPress plugin/);
    expect(lineFor('Your website')).toMatch(/^- Your website: In testing\. Store Chat only/);
    expect(lineFor('Salla')).toMatch(/^- Salla: Planned\. No code yet/);
    expect(lineFor('Zid')).toMatch(/^- Zid: Planned\. No code yet/);
    expect(text).toContain('Paid plans are billed through Shopify for Shopify stores and arranged with GRINDCTRL for WooCommerce stores.');
    for (const id of ['shopify', 'woocommerce', 'custom-website', 'salla', 'zid']) {
      expect(findPublicIntegration(id), id).toBeDefined();
    }
  });

  it('never calls an in-testing or planned platform live, supported, available or working with GRINDCTRL', () => {
    for (const name of ['Your website', 'Salla', 'Zid']) {
      expect(lineFor(name), name).not.toMatch(/\b(supported|works with|compatible)\b/i);
      expect(lineFor(name), name).not.toMatch(/\bLive\b/);
    }
    expect(lineFor('Your website')).toContain('Not available to merchants yet.');
    expect(text).not.toMatch(/app store/i);
  });

  it('scopes WooCommerce to Try-On, Store Chat and order status and claims no marketplace listing or wide support', () => {
    const line = lineFor('WooCommerce');
    expect(line).not.toMatch(/\b(supported|works with|compatible|all)\b/i);
    expect(line).not.toContain('Not available to merchants');
    expect(text).not.toMatch(/wordpress\.org|marketplace/i);
    expect(text).toContain('It is live on Shopify and WooCommerce.');
  });

  it('links every public page by absolute URL, and each one is in the sitemap', () => {
    const sitemapUrls = sitemap().map((entry) => entry.url);
    for (const page of LLMS_PAGES) {
      expect(text).toContain(`](${ORIGIN}${page.path}):`);
      expect(sitemapUrls, page.path).toContain(`${ORIGIN}${page.path}`);
    }
    expect(text).toContain(`(${BOOKING_URL})`);
  });

  it('follows the origin it is given and stays plain text with no em dash', () => {
    expect(buildLlmsTxt('https://staging.example.test')).toContain('](https://staging.example.test/pricing):');
    expect(text).not.toContain('—');
    expect(text).not.toMatch(/\*\*|<[a-z]/i);
  });
});
