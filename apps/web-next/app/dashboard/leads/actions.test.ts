import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/adapters/widgetSites', async () => {
  const actual = await vi.importActual<typeof import('@/lib/adapters/widgetSites')>('@/lib/adapters/widgetSites');
  return {
    ...actual,
    updateWidgetSite: vi.fn(),
  };
});

import { saveLeadSettingsAction } from '@/app/dashboard/leads/actions';
import { updateWidgetSite } from '@/lib/adapters/widgetSites';

describe('saveLeadSettingsAction', () => {
  it('saves lead capture settings through settings_json only', async () => {
    vi.mocked(updateWidgetSite).mockResolvedValue({
      id: 'site_1',
      workspace_id: 'workspace_1',
      name: 'Main Site',
      embed_key: 'gc_live_real_embed',
      status: 'active',
      settings_json: {
        leads: {
          enabled: true,
          capture_timing: 'post_chat',
          fields: ['name', 'email', 'company'],
          required_fields: ['email'],
          prompt_title: 'Stay in touch',
          prompt_subtitle: 'Share your details for a follow-up.',
          skippable: true,
          dedupe: { mode: 'email' },
          consent: {
            mode: 'required',
            text: 'I agree to be contacted.',
            privacy_url: 'https://example.com/privacy',
          },
        },
      },
    });

    const formData = new FormData();
    formData.set('enabled', 'on');
    formData.set('captureTiming', 'post_chat');
    formData.append('fields', 'name');
    formData.append('fields', 'email');
    formData.append('fields', 'company');
    formData.append('requiredFields', 'email');
    formData.set('promptTitle', 'Stay in touch');
    formData.set('promptSubtitle', 'Share your details for a follow-up.');
    formData.set('skippable', 'on');
    formData.set('dedupeMode', 'email');
    formData.set('consentMode', 'required');
    formData.set('consentText', 'I agree to be contacted.');
    formData.set('privacyUrl', 'https://example.com/privacy');

    const result = await saveLeadSettingsAction(
      {
        clerkUserId: 'user_123',
        siteId: 'site_123',
        currentSettings: {
          branding: {
            brand_name: '',
            assistant_name: 'Support',
            logo_url: '',
            avatar_url: '',
            launcher_label: 'Support',
            launcher_icon: 'chat',
            theme_mode: 'auto',
            radius_style: 'soft',
            attribution: { mode: 'auto', show_powered_by: true },
          },
          widget: {
            position: 'bottom-right',
            default_open: false,
            show_intents: true,
            rtl_supported: true,
            locale: 'auto',
          },
          leads: {
            enabled: false,
            capture_timing: 'off',
            fields: ['name', 'email'],
            required_fields: ['email'],
            prompt_title: '',
            prompt_subtitle: '',
            skippable: false,
            dedupe: { mode: 'session' },
            consent: { mode: 'none', text: '', privacy_url: '' },
          },
          routing: {
            default_intent_behavior: 'chat',
            handoff: { enabled: false, channel: 'email', target: '' },
            availability: { enabled: false, timezone: 'UTC', hours: [] },
          },
          security: {
            allow_localhost: true,
            allowed_iframe_parents: [],
            rate_limits: { bootstrap_per_min: 60, messages_per_min: 20, leads_per_hour: 30 },
          },
        },
      },
      formData,
    );

    expect(updateWidgetSite).toHaveBeenCalledWith({
      clerkUserId: 'user_123',
      siteId: 'site_123',
      settingsJson: expect.objectContaining({
        leads: {
          enabled: true,
          capture_timing: 'post_chat',
          fields: ['name', 'email', 'company'],
          required_fields: ['email'],
          prompt_title: 'Stay in touch',
          prompt_subtitle: 'Share your details for a follow-up.',
          skippable: true,
          dedupe: { mode: 'email' },
          consent: {
            mode: 'required',
            text: 'I agree to be contacted.',
            privacy_url: 'https://example.com/privacy',
          },
        },
      }),
    });

    const call = vi.mocked(updateWidgetSite).mock.calls[0]?.[0];
    expect(call).not.toHaveProperty('name');
    expect(call).not.toHaveProperty('status');
    expect(call).not.toHaveProperty('configJson');
    expect(call).not.toHaveProperty('brandingJson');
    expect(call).not.toHaveProperty('leadCaptureJson');

    expect(result.status).toBe('success');
    expect(result.message).toBe('Lead capture settings saved to settings_json.');
    expect(result.values.enabled).toBe(true);
    expect(result.values.captureTiming).toBe('post_chat');
    expect(result.values.fields).toEqual(['name', 'email', 'company']);
  });
});
