// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toPublicPayload } from './public-api';
import { resolveMessengerConfig } from './config';

function site(status: string) {
  return {
    name: 'Maison',
    embed_key: 'gc_test_key',
    status,
    settings_version: 3,
    config: resolveMessengerConfig({}),
  };
}

describe('toPublicPayload features', () => {
  it("lists the store's v16 features while the site is active", () => {
    const payload = toPublicPayload(site('active'), new Date(), ['n23_after_hours']);
    expect(payload.features).toEqual(['n23_after_hours']);
  });

  it('lists none for a site that is off, and none by default', () => {
    expect(toPublicPayload(site('disabled'), new Date(), ['n23_after_hours']).features).toEqual([]);
    expect(toPublicPayload(site('active'), new Date()).features).toEqual([]);
  });
});
