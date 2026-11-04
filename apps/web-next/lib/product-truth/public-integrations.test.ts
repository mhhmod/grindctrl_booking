import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findPublicIntegration,
  PUBLIC_INTEGRATIONS,
  PUBLIC_INTEGRATION_STATES,
} from './public-integrations';

const REPO_ROOT = join(__dirname, '../../../..');

describe('public integration truth', () => {
  it('uses unique stable ids and an explicit relationship state', () => {
    const ids = PUBLIC_INTEGRATIONS.map((integration) => integration.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const integration of PUBLIC_INTEGRATIONS) {
      expect(integration.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(PUBLIC_INTEGRATION_STATES).toContain(integration.state);
      expect(integration.note.length).toBeGreaterThan(0);
    }
  });

  it('does not present planned, credential-dependent, or evidence-free tools as implemented', () => {
    expect(findPublicIntegration('telegram')?.state).toBe('planned');
    expect(findPublicIntegration('whatsapp')?.state).toBe('evidence-required');
    expect(findPublicIntegration('instagram')?.state).toBe('evidence-required');
  });

  it('keeps tools with no code and no roadmap entry at evidence-required, HubSpot included', () => {
    // The dashboard catalogue that once marked Zapier, Make and Notion as
    // planned was deleted, and no code connects HubSpot.
    for (const id of ['zapier', 'make', 'notion', 'hubspot']) {
      expect(findPublicIntegration(id), id).toMatchObject({ state: 'evidence-required', evidenceRef: null });
    }
  });

  it('lists the platforms with a state that matches what main ships', () => {
    expect(findPublicIntegration('shopify')?.state).toBe('implemented');
    expect(findPublicIntegration('woocommerce')).toMatchObject({
      name: 'WooCommerce',
      state: 'implemented',
      evidenceRef: 'docs/superpowers/checkpoints/2026-11-04-woocommerce-live.md',
    });
    expect(findPublicIntegration('custom-website')).toMatchObject({ name: 'Your website', state: 'in-testing' });
    expect(findPublicIntegration('salla')).toMatchObject({ name: 'Salla', state: 'planned' });
    expect(findPublicIntegration('zid')).toMatchObject({ name: 'Zid', state: 'planned' });
    // Only Shopify and WooCommerce (Store Chat only) may be implemented.
    const implemented = PUBLIC_INTEGRATIONS.filter((item) => item.state === 'implemented').map((item) => item.id);
    expect(implemented).toEqual(['shopify', 'woocommerce']);
  });

  it('says Store Chat only for the in-testing website and never words it as shipped', () => {
    const note = findPublicIntegration('custom-website')!.note;
    expect(note).toMatch(/Store Chat only/);
    expect(note).toMatch(/not available to merchants/i);
    expect(note).not.toMatch(/\b(supported|works with|available now|live)\b/i);
  });

  it('keeps WooCommerce scoped to Store Chat and never claims a marketplace listing or wide support', () => {
    const note = findPublicIntegration('woocommerce')!.note;
    expect(note).toMatch(/Store Chat only/);
    expect(note).toMatch(/Try-On, order lookup and billing are Shopify-only/);
    expect(note).not.toMatch(/\b(supported|works with|compatible|all)\b/i);
    expect(note).not.toMatch(/wordpress\.org|marketplace/i);
  });

  it('says no code connects Salla or Zid', () => {
    for (const id of ['salla', 'zid']) {
      expect(findPublicIntegration(id)!.note, id).toMatch(/No code connects/);
    }
  });

  it('points every evidence reference at a file or folder that exists', () => {
    // Stale references once went unnoticed after the files they named were deleted.
    for (const integration of PUBLIC_INTEGRATIONS) {
      if (integration.evidenceRef === null) continue;
      expect(existsSync(join(REPO_ROOT, integration.evidenceRef)), `${integration.id}: ${integration.evidenceRef}`).toBe(true);
    }
  });

  it('keeps the readiness matrix consistent with the register for the platform rows', () => {
    const matrix = readFileSync(join(REPO_ROOT, 'docs/platform-readiness-matrix.md'), 'utf8');
    const rowFor = (name: string) => matrix.split('\n').find((line) => line.startsWith(`| ${name} |`)) ?? '';
    expect(rowFor('WooCommerce')).toMatch(/\| implemented \(Store Chat only\) \|/);
    expect(rowFor('WooCommerce')).toContain('docs/superpowers/checkpoints/2026-11-04-woocommerce-live.md');
    expect(rowFor('Custom website')).toMatch(/\| in testing/);
    expect(rowFor('Salla')).toMatch(/\| planned \|/);
    expect(rowFor('Zid')).toMatch(/\| planned \|/);
  });

  it('never labels an evidence-free relationship as implemented or setup-ready', () => {
    for (const integration of PUBLIC_INTEGRATIONS.filter((item) => item.evidenceRef === null)) {
      expect(['implemented', 'setup-required']).not.toContain(integration.state);
    }
  });

  it('distinguishes infrastructure from a merchant integration', () => {
    expect(findPublicIntegration('supabase')?.state).toBe('infrastructure');
    expect(findPublicIntegration('groq')?.state).toBe('infrastructure');
    expect(findPublicIntegration('openrouter')?.state).toBe('infrastructure');
  });

  it('lists the AI providers actually paid for and called, with real evidence refs', () => {
    // Groq (site assistant chat/STT/TTS) and OpenRouter (Try-On image generation,
    // Store Chat replies, vision triage)
    // are the only two AI providers with a real API key, SDK/fetch call, and env
    // var in the codebase — see lib/assistant/groq-client.ts and
    // lib/try-on/image-runner.ts.
    expect(findPublicIntegration('groq')?.evidenceRef).toBeTruthy();
    expect(findPublicIntegration('openrouter')?.evidenceRef).toBeTruthy();
  });

  it('never lists a raw underlying AI model as a directly integrated provider', () => {
    // Gemini/Claude/OpenAI are only reachable indirectly, as swappable model
    // slugs passed through the Groq/OpenRouter infrastructure entries above —
    // they must never appear as their own register row or brand mark.
    for (const bannedId of ['gemini', 'claude', 'anthropic', 'openai', 'gpt']) {
      expect(findPublicIntegration(bannedId)).toBeUndefined();
    }
  });
});
