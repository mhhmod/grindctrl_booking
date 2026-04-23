import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/adapters/widgetSites', async () => {
  const actual = await vi.importActual<typeof import('@/lib/adapters/widgetSites')>('@/lib/adapters/widgetSites');
  return {
    ...actual,
    updateWidgetSite: vi.fn(),
  };
});

import { saveBrandingAction } from '@/app/dashboard/branding/actions';
import { updateWidgetSite } from '@/lib/adapters/widgetSites';

describe('saveBrandingAction', () => {
  it('saves branding through settings_json only and returns round-tripped values', async () => {
    vi.mocked(updateWidgetSite).mockResolvedValue({
      id: 'site_1',
      workspace_id: 'workspace_1',
      name: 'Main Site',
      embed_key: 'gc_live_real_embed',
      status: 'active',
      settings_json: {
        branding: {
          brand_name: 'ACME Labs',
          assistant_name: 'Nova',
          logo_url: 'https://cdn.example.com/logo.svg',
          avatar_url: 'https://cdn.example.com/avatar.png',
          launcher_label: 'Chat with ACME',
          launcher_icon: 'sparkles',
          theme_mode: 'dark',
          radius_style: 'rounded',
          attribution: {
            mode: 'always',
            show_powered_by: true,
          },
        },
        widget: {
          position: 'bottom-left',
        },
      },
    });

    const formData = new FormData();
    formData.set('brandName', 'ACME Labs');
    formData.set('assistantName', 'Nova');
    formData.set('logoUrl', 'https://cdn.example.com/logo.svg');
    formData.set('avatarUrl', 'https://cdn.example.com/avatar.png');
    formData.set('launcherLabel', 'Chat with ACME');
    formData.set('launcherIcon', 'sparkles');
    formData.set('themeMode', 'dark');
    formData.set('radiusStyle', 'rounded');
    formData.set('widgetPosition', 'bottom-left');
    formData.set('attributionMode', 'always');
    formData.set('showPoweredBy', 'on');

    const result = await saveBrandingAction(
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
            attribution: {
              mode: 'auto',
              show_powered_by: false,
            },
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
      settingsJson: {
        branding: {
          brand_name: 'ACME Labs',
          assistant_name: 'Nova',
          logo_url: 'https://cdn.example.com/logo.svg',
          avatar_url: 'https://cdn.example.com/avatar.png',
          launcher_label: 'Chat with ACME',
          launcher_icon: 'sparkles',
          theme_mode: 'dark',
          radius_style: 'rounded',
          attribution: {
            mode: 'always',
            show_powered_by: true,
          },
        },
        widget: {
          position: 'bottom-left',
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
    });

    const call = vi.mocked(updateWidgetSite).mock.calls[0]?.[0];
    expect(call).not.toHaveProperty('name');
    expect(call).not.toHaveProperty('status');
    expect(call).not.toHaveProperty('configJson');
    expect(call).not.toHaveProperty('brandingJson');
    expect(call).not.toHaveProperty('leadCaptureJson');

    expect(result.status).toBe('success');
    expect(result.values.brandName).toBe('ACME Labs');
    expect(result.values.widgetPosition).toBe('bottom-left');
    expect(result.values.showPoweredBy).toBe(true);
  });
});
