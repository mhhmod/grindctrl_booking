import { test, expect } from '@playwright/test';

function expectedCanonicalSnippet(embedKey: string) {
  const key = String(embedKey);
  return [
    '<script>',
    '  window.GrindctrlSupport = window.GrindctrlSupport || [];',
    '  window.GrindctrlSupport.push({',
    `    embedKey: '${key}',`,
    '    user: {',
    '      id: null,',
    '      email: null,',
    '      name: null',
    '    },',
    '    context: {',
    '      custom: {}',
    '    }',
    '  });',
    '</script>',
    '<script async src="https://cdn.grindctrl.com/widget/v1/loader.js"></script>',
  ].join('\n');
}

function expectedCspSnippet(embedKey: string) {
  const key = String(embedKey);
  return [
    '<script',
    '  async',
    '  src="https://cdn.grindctrl.com/widget/v1/loader.js"',
    `  data-gc-embed-key="${key}">`,
    '</script>',
  ].join('\n');
}

test.describe('Dashboard Settings Cutover (settings_json authority)', () => {
  test('install snippets match spec canonical + CSP variants', async ({ page }) => {
    const embedKey = 'gc_live_test_cutover';

    await page.addInitScript(({ embedKey }) => {
      const nowIso = new Date().toISOString();

      const state: any = {
        profile: { id: '00000000-0000-0000-0000-000000000001', created_at: nowIso },
        workspace: {
          id: '00000000-0000-0000-0000-000000000010',
          name: 'E2E Workspace',
          owner_profile_id: '00000000-0000-0000-0000-000000000001',
          created_at: nowIso,
        },
        sites: [
          {
            id: '00000000-0000-0000-0000-000000000100',
            workspace_id: '00000000-0000-0000-0000-000000000010',
            name: 'E2E Site',
            embed_key: embedKey,
            status: 'active',
            settings_json: {},
            settings_version: 1,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ],
        domains: [],
        intents: [],
        leads: [],
      };

      const calls: any[] = [];

      (window as any).__gcSupabaseMock = {
        __calls: calls,
        __state: state,
        rpc: async (fn: string, params: any) => {
          calls.push({ fn, params });

          if (fn === 'bootstrap_user') {
            return { data: { profile: state.profile, workspace: state.workspace }, error: null };
          }
          if (fn === 'get_user_workspace') {
            return { data: { workspace: state.workspace, sites: state.sites }, error: null };
          }
          if (fn === 'dashboard_get_user_role') {
            return { data: 'owner', error: null };
          }
          if (fn === 'dashboard_list_domains') {
            return { data: state.domains, error: null };
          }
          if (fn === 'dashboard_list_intents') {
            return { data: state.intents, error: null };
          }
          if (fn === 'dashboard_list_leads') {
            return { data: state.leads, error: null };
          }
          if (fn === 'dashboard_update_widget_site') {
            const site = state.sites.find((s: any) => s.id === params?.p_site_id);
            if (!site) return { data: null, error: { message: 'site_not_found' } };

            if (params?.p_name) site.name = params.p_name;
            if (params?.p_status) site.status = params.p_status;
            if (params?.p_settings_json) site.settings_json = params.p_settings_json;
            site.updated_at = new Date().toISOString();

            return { data: { ...site }, error: null };
          }

          return { data: null, error: { message: `unhandled_rpc:${fn}` } };
        },
      };

      (window as any).__gcClerkMock = {
        isSignedIn: true,
        user: {
          id: 'user_e2e',
          firstName: 'E2E',
          lastName: 'User',
          fullName: 'E2E User',
          username: 'e2e',
          imageUrl: '',
          primaryEmailAddress: { emailAddress: 'e2e@example.com' },
        },
        mountUserButton: () => {},
      };
    }, { embedKey });

    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#app-content')).toBeVisible();
    await expect(page.locator('#embed-key-display')).toHaveValue(embedKey);
    await expect(page.locator('#setup-snippet')).toContainText(embedKey);

    const canonical = await page.locator('#setup-snippet').textContent();
    expect(canonical).toBe(expectedCanonicalSnippet(embedKey));

    await expect(page.locator('#setup-snippet-csp')).toContainText(embedKey);
    const csp = await page.locator('#setup-snippet-csp').textContent();
    expect(csp).toBe(expectedCspSnippet(embedKey));
  });

  test('dashboard saves only settings_json and widget runtime bootstraps with saved settings', async ({ page }) => {
    const embedKey = 'gc_live_test_cutover';

    await page.addInitScript(({ embedKey }) => {
      const nowIso = new Date().toISOString();

      const state: any = {
        profile: { id: '00000000-0000-0000-0000-000000000001', created_at: nowIso },
        workspace: {
          id: '00000000-0000-0000-0000-000000000010',
          name: 'E2E Workspace',
          owner_profile_id: '00000000-0000-0000-0000-000000000001',
          created_at: nowIso,
        },
        sites: [
          {
            id: '00000000-0000-0000-0000-000000000100',
            workspace_id: '00000000-0000-0000-0000-000000000010',
            name: 'E2E Site',
            embed_key: embedKey,
            status: 'active',
            settings_json: {},
            settings_version: 1,
            created_at: nowIso,
            updated_at: nowIso,
          },
        ],
        domains: [],
        intents: [],
        leads: [],
      };

      const calls: any[] = [];

      (window as any).__gcSupabaseMock = {
        __calls: calls,
        __state: state,
        rpc: async (fn: string, params: any) => {
          calls.push({ fn, params });

          if (fn === 'bootstrap_user') {
            return { data: { profile: state.profile, workspace: state.workspace }, error: null };
          }
          if (fn === 'get_user_workspace') {
            return { data: { workspace: state.workspace, sites: state.sites }, error: null };
          }
          if (fn === 'dashboard_get_user_role') {
            return { data: 'owner', error: null };
          }
          if (fn === 'dashboard_list_domains') {
            return { data: state.domains, error: null };
          }
          if (fn === 'dashboard_list_intents') {
            return { data: state.intents, error: null };
          }
          if (fn === 'dashboard_list_leads') {
            return { data: state.leads, error: null };
          }
          if (fn === 'dashboard_update_widget_site') {
            const site = state.sites.find((s: any) => s.id === params?.p_site_id);
            if (!site) return { data: null, error: { message: 'site_not_found' } };

            if (params?.p_name) site.name = params.p_name;
            if (params?.p_status) site.status = params.p_status;
            if (params?.p_settings_json) site.settings_json = params.p_settings_json;
            site.updated_at = new Date().toISOString();

            return { data: { ...site }, error: null };
          }

          return { data: null, error: { message: `unhandled_rpc:${fn}` } };
        },
      };

      (window as any).__gcClerkMock = {
        isSignedIn: true,
        user: {
          id: 'user_e2e',
          firstName: 'E2E',
          lastName: 'User',
          fullName: 'E2E User',
          username: 'e2e',
          imageUrl: '',
          primaryEmailAddress: { emailAddress: 'e2e@example.com' },
        },
        mountUserButton: () => {},
      };
    }, { embedKey });

    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#app-content')).toBeVisible();
    await expect(page.locator('#embed-key-display')).toHaveValue(embedKey);

    // Save Branding -> settings_json
    await page.locator('.gc-app-sidebar-item[data-screen="branding"]').click();
    await expect(page.locator('#screen-branding')).toHaveClass(/active/);

    await page.fill('#branding-name', 'ACME');
    await page.fill('#branding-logo-url', 'https://example.com/logo.png');
    await page.fill('#branding-assistant-name', 'Acme Support');
    await page.fill('#branding-launcher-label', 'Help');
    await page.selectOption('#branding-launcher-position', 'bottom-left');
    await page.selectOption('#branding-radius-style', 'rounded');

    await page.click('#btn-save-branding');
    await expect(page.locator('#toast-container')).toContainText('Branding saved');

    // Save Leads -> settings_json
    await page.locator('.gc-app-sidebar-item[data-screen="leads"]').click();
    await expect(page.locator('#screen-leads')).toHaveClass(/active/);

    await page.locator('#lead-capture-enabled').check();
    await page.selectOption('#lead-capture-timing', 'before_chat_skippable');
    await page.locator('#lead-field-phone').check();
    await page.fill('#lead-capture-prompt', 'Tell us a bit about yourself');

    await page.click('#btn-save-lead-capture');
    await expect(page.locator('#toast-container')).toContainText('Lead capture settings saved');

    const updateCalls = await page.evaluate(() => {
      const calls = (window as any).__gcSupabaseMock.__calls || [];
      return calls.filter((c: any) => c.fn === 'dashboard_update_widget_site');
    });

    expect(updateCalls.length).toBeGreaterThanOrEqual(2);

    for (const call of updateCalls) {
      const params = call.params || {};
      expect(params.p_settings_json).toBeTruthy();
      expect(params.p_config_json).toBeUndefined();
      expect(params.p_branding_json).toBeUndefined();
      expect(params.p_lead_capture_json).toBeUndefined();
    }

    const lastSettings = updateCalls[updateCalls.length - 1].params.p_settings_json;
    expect(lastSettings.branding.primary_color).toBeUndefined();
    expect(lastSettings.branding.accent_color).toBeUndefined();
    expect(lastSettings.branding.brand_name).toBe('ACME');
    expect(lastSettings.branding.launcher_label).toBe('Help');
    expect(lastSettings.widget.position).toBe('bottom-left');
    expect(lastSettings.leads.enabled).toBe(true);
    expect(lastSettings.leads.capture_timing).toBe('before_chat_skippable');
    expect(lastSettings.leads.fields).toEqual(['name', 'email', 'phone']);
    expect(lastSettings.leads.required_fields).toEqual(['email']);
    expect(lastSettings.leads.prompt_subtitle).toBe('Tell us a bit about yourself');
    expect(lastSettings.leads.skippable).toBe(true);

    // Runtime bootstrap smoke: respond using saved settings_json.
    const savedSettings = await page.evaluate(() => {
      const state = (window as any).__gcSupabaseMock.__state;
      return state.sites[0].settings_json;
    });

    const origin = 'http://localhost:4173';

    await page.route('**/functions/v1/widget-bootstrap', async (route) => {
      const req = route.request();
      const headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization, x-grindctrl-widget-version',
        'Access-Control-Max-Age': '86400',
      } as Record<string, string>;

      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers, body: '' });
        return;
      }

      const body = {
        ok: true,
        runtime: { version: '1.0.0', config_version: 1 },
        site: {
          id: '00000000-0000-0000-0000-000000000100',
          name: 'E2E Site',
          branding: savedSettings.branding,
          widget: savedSettings.widget,
          leads: savedSettings.leads,
          intents: [],
        },
        auth: { embed_session_token: 'test_token', expires_in_sec: 3600 },
        polling: { min_interval_ms: 1500, max_interval_ms: 6000 },
      };

      await route.fulfill({ status: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    });

    await page.route('**/functions/v1/widget-event', async (route) => {
      const req = route.request();
      const headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization, x-grindctrl-widget-version',
        'Access-Control-Max-Age': '86400',
      } as Record<string, string>;

      if (req.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers, body: '' });
        return;
      }

      await route.fulfill({ status: 200, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) });
    });

    await page.evaluate(({ embedKey }) => {
      (window as any).GrindctrlSupport = (window as any).GrindctrlSupport || [];
      (window as any).GrindctrlSupport.push({
        embedKey,
        user: { id: null, email: null, name: null },
        context: { custom: {} },
      });

      const script = document.createElement('script');
      script.src = '/scripts/grindctrl-support.js';
      script.async = true;
      document.body.appendChild(script);
    }, { embedKey });

    await expect(page.locator('#gc-widget-host')).toBeVisible();

    const bootstrapCache = await page.evaluate(({ embedKey, origin }) => {
      const k = `gc_bootstrap:${embedKey}:${origin}`;
      const raw = sessionStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    }, { embedKey, origin });

    expect(bootstrapCache?.bootstrap?.site?.branding?.launcher_label).toBe('Help');
    expect(bootstrapCache?.bootstrap?.site?.leads?.capture_timing).toBe('before_chat_skippable');
  });
});
