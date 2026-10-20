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

describe('toPublicPayload team hours (n23_after_hours)', () => {
  it('says when the team is in only while the flag is on', () => {
    const base = site('active');
    const config = {
      ...base.config,
      behaviour: {
        ...base.config.behaviour,
        availabilityMode: 'hours' as const,
        availabilityTimezone: 'UTC',
        availabilityHours: [{ day: 5, startMinute: 600, endMinute: 1320 }],
      },
    };
    const friday11am = new Date('2026-10-16T11:00:00Z');
    expect(toPublicPayload({ ...base, config }, friday11am, ['n23_after_hours']).team).toEqual({
      open: true,
      opensAt: null,
      closesAt: '22:00',
      timezone: 'UTC',
    });
    expect(toPublicPayload({ ...base, config }, friday11am, []).team).toBeNull();
    // The v16 header's team half follows the same hours.
    expect(toPublicPayload({ ...base, config }, friday11am, ['v16_chat']).team).toEqual(
      toPublicPayload({ ...base, config }, friday11am, ['n23_after_hours']).team,
    );
  });
});
