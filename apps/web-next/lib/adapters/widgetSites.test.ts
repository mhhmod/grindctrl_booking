import { describe, expect, it } from 'vitest';
import { buildWidgetSiteUpdateRpcParams, normalizeSettingsJson } from '@/lib/adapters/widgetSites';

describe('widget site adapter', () => {
  it('keeps settings_json as the only update payload authority', () => {
    const params = buildWidgetSiteUpdateRpcParams({
      clerkUserId: 'user_123',
      siteId: 'site_123',
      settingsJson: { branding: { brand_name: 'ACME' } },
    });

    expect(params.p_settings_json).toEqual({ branding: { brand_name: 'ACME' } });
    expect(params).not.toHaveProperty('p_config_json');
    expect(params).not.toHaveProperty('p_branding_json');
    expect(params).not.toHaveProperty('p_lead_capture_json');
  });

  it('normalizes missing settings sections without introducing legacy sources', () => {
    const settings = normalizeSettingsJson({ branding: { brand_name: 'ACME' } });
    expect(settings.branding.brand_name).toBe('ACME');
    expect(settings.widget.position).toBe('bottom-right');
    expect(settings.leads.fields).toEqual(['name', 'email']);
  });
});
