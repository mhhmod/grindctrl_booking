// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { appEmbedActivationUrl } from '@/lib/shopify/app-identity';

/* The Installation tab told merchants to toggle "GRINDCTRL Support Messenger"
   while the theme editor listed the block as "GRINDCTRL Store Chat". Following
   the instruction exactly found nothing, and Store Chat looked impossible to
   enable. Copy and schema live in different apps, so nothing but a test keeps
   them honest. */

const blockLiquid = readFileSync(
  path.resolve(process.cwd(), '../grindctrl-tryon/extensions/tryon-block/blocks/messenger.liquid'),
  'utf8',
);
const installCard = readFileSync(
  path.resolve(process.cwd(), 'components/dashboard/messenger/install-card.tsx'),
  'utf8',
);

/** The name the theme editor renders, read from the block's own schema. */
function schemaName(liquid: string): string {
  const match = /"name"\s*:\s*"([^"]+)"/.exec(liquid);
  if (!match) throw new Error('messenger.liquid has no schema name');
  return match[1];
}

describe('Store Chat install instructions', () => {
  it('names the exact block the theme editor shows, in both locales', () => {
    const name = schemaName(blockLiquid);
    expect(name).toBe('GRINDCTRL Store Chat');

    // Both the English and Arabic steps quote it; the Arabic copy leaves the
    // block name untranslated because the theme editor shows it in English.
    const quoted = installCard.match(/“([^”]+)”/g) ?? [];
    expect(quoted.length).toBeGreaterThanOrEqual(2);
    for (const occurrence of quoted) {
      expect(occurrence).toBe(`“${name}”`);
    }
  });

  it('deep-links to the App embeds panel rather than the theme list', () => {
    const url = appEmbedActivationUrl('grindctrl.myshopify.com', 'messenger');

    expect(url).toContain('/admin/themes/current/editor');
    expect(url).toContain('context=apps');
    // <client-id>/<block handle>, where the handle is the block's filename.
    expect(url).toContain('activateAppId=fc095fe656d9029fdc249a4af2315f19/messenger');
    // The generic theme list is what left the merchant to navigate themselves.
    expect(installCard).not.toContain('/themes`');
  });
});
