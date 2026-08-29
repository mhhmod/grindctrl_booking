import { describe, expect, it } from 'vitest';
import {
  MESSENGER_DEFAULTS,
  mergeDraftOverPublished,
  resolveMessengerConfig,
} from './config';

describe('resolveMessengerConfig', () => {
  it('returns full defaults for empty settings', () => {
    const config = resolveMessengerConfig({});
    expect(config.appearance.accentColor).toBe(MESSENGER_DEFAULTS.appearance.accentColor);
    expect(config.behaviour.proactiveEnabled).toBe(false);
    expect(config.ai.enabled).toBe(false);
  });

  it('rejects invalid accent colors and keeps defaults', () => {
    const config = resolveMessengerConfig({
      messenger_appearance: { accentColor: 'javascript:alert(1)' },
    });
    expect(config.appearance.accentColor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('clamps launcher size and delays to sane bounds', () => {
    const config = resolveMessengerConfig({
      messenger_appearance: { launcherSizePx: 500 },
      messenger_behaviour: { greetingDelaySeconds: 9999 },
    });
    expect(config.appearance.launcherSizePx).toBe(72);
    expect(config.behaviour.greetingDelaySeconds).toBe(120);
  });

  it('fills the missing side of localized strings from the other language', () => {
    const config = resolveMessengerConfig({
      messenger_behaviour: { welcomeTitle: { en: 'Hey there' } },
    });
    expect(config.behaviour.welcomeTitle.en).toBe('Hey there');
    expect(config.behaviour.welcomeTitle.ar.length).toBeGreaterThan(0);
  });

  it('sanitizes exclude patterns and caps their count', () => {
    const config = resolveMessengerConfig({
      messenger_behaviour: {
        targetingMode: 'custom',
        excludePatterns: ['/Checkout', ' /blog ', '', null, 42],
      },
    });
    expect(config.behaviour.excludePatterns).toEqual(['/checkout', '/blog']);
  });

  it('never throws on garbage shapes', () => {
    expect(() =>
      resolveMessengerConfig({ messenger_ai: { enabled: 'yes' }, messenger_appearance: [] }),
    ).not.toThrow();
  });
});

describe('mergeDraftOverPublished', () => {
  it('reports no draft when draft is empty', () => {
    const { hasDraft } = mergeDraftOverPublished({}, {});
    expect(hasDraft).toBe(false);
  });

  it('merges partial appearance drafts without losing published fields', () => {
    const published = {
      messenger_appearance: { accentColor: '#111111', position: 'bottom-left' },
    };
    const draft = { messenger_appearance: { accentColor: '#ff0000' } };
    const { config, hasDraft } = mergeDraftOverPublished(published, draft);
    expect(hasDraft).toBe(true);
    expect(config.appearance.accentColor).toBe('#ff0000');
    expect(config.appearance.position).toBe('bottom-left');
  });
});

describe('notification settings', () => {
  it('defaults to emailing on handoff with no explicit recipients', () => {
    const config = resolveMessengerConfig({});
    expect(config.notifications.emailOnHandoff).toBe(true);
    expect(config.notifications.recipients).toEqual([]);
  });

  it('keeps only well-formed recipient addresses, capped at five', () => {
    const config = resolveMessengerConfig({
      messenger_notifications: {
        emailOnHandoff: false,
        recipients: [
          '  Owner@Example.com ',
          'not-an-email',
          '',
          'a@b.co',
          'c@d.co',
          'e@f.co',
          'g@h.co',
          'i@j.co',
        ],
      },
    });
    expect(config.notifications.emailOnHandoff).toBe(false);
    expect(config.notifications.recipients).toEqual([
      'owner@example.com',
      'a@b.co',
      'c@d.co',
      'e@f.co',
      'g@h.co',
    ]);
  });
});
