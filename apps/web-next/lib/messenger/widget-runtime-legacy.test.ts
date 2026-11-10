// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* G12: the legacy runtime (public/widget/v1/runtime.js, still loaded by
   loader.js on old installs) renders merchant settings. None of them may
   become markup, and none may become a javascript: (or any non-http) URL. */
const runtime = readFileSync(path.resolve(process.cwd(), 'public/widget/v1/runtime.js'), 'utf8');

function bootstrap(overrides: { consent?: Record<string, unknown>; logo?: string; intents?: unknown[]; fields?: unknown[] } = {}) {
  return {
    ok: true,
    auth: { embed_session_token: 'tok', expires_in_sec: 3600 },
    polling: { min_interval_ms: 60_000, max_interval_ms: 60_000 },
    site: {
      id: 'site-1',
      name: 'Maison',
      branding: { brand_name: 'Maison', logo_url: overrides.logo ?? '' },
      widget: { default_open: true, show_intents: true },
      leads: {
        enabled: true,
        capture_timing: 'before_chat',
        fields: overrides.fields ?? ['email'],
        required_fields: [],
        consent: { mode: 'checkbox', ...overrides.consent },
      },
      intents: overrides.intents ?? [],
    },
  };
}

let shadow: ShadowRoot | null;
let opened: ReturnType<typeof vi.fn>;

async function boot(data: ReturnType<typeof bootstrap>) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })));
  window.eval(runtime);
  (window as unknown as { GrindctrlSupport: { init: (o: unknown) => void } }).GrindctrlSupport.init({ embedKey: 'pk_test_123' });
  await waitFor(() => expect(shadow?.getElementById('gc-panel')).toBeTruthy());
  return shadow!;
}

beforeEach(() => {
  shadow = null;
  document.body.innerHTML = '';
  window.localStorage.clear();
  delete (window as { GrindctrlSupport?: unknown }).GrindctrlSupport;
  // The runtime's shadow root is closed; keep a handle for the assertions.
  const attach = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init: ShadowRootInit) {
    shadow = attach.call(this, init);
    return shadow;
  });
  opened = vi.fn();
  vi.stubGlobal('open', opened);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('legacy runtime merchant settings (G12)', () => {
  it('renders the consent text as text and refuses a javascript: privacy link', async () => {
    const root = await boot(bootstrap({ consent: { text: '<img src=x onerror="window.__pwned=1">I agree', privacy_url: 'javascript:alert(1)' } }));
    const label = root.getElementById('gc-consent-text')!;
    expect(label.textContent).toBe('<img src=x onerror="window.__pwned=1">I agree');
    expect(label.querySelector('img')).toBeNull();
    expect(label.querySelector('a')).toBeNull();
    expect((window as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('keeps an https privacy link, opening safely in a new tab', async () => {
    const root = await boot(bootstrap({ consent: { text: 'I agree', privacy_url: 'https://maison.example/privacy' } }));
    const link = root.querySelector<HTMLAnchorElement>('#gc-consent-text a')!;
    expect(link.href).toBe('https://maison.example/privacy');
    expect(link.rel).toBe('noopener noreferrer');
    expect(link.target).toBe('_blank');
  });

  it.each(['javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', 'JAVASCRIPT:alert(1)'])('shows no logo for %s', async (logo) => {
    const root = await boot(bootstrap({ logo }));
    expect(root.querySelector('.gc-header-logo img')).toBeNull();
  });

  it('drops a lead field name that is not a plain identifier', async () => {
    const root = await boot(bootstrap({ fields: ['email', 'x" autofocus onfocus="window.__pwned=1'] }));
    expect(root.querySelectorAll('.gc-lead-input')).toHaveLength(1);
    expect(root.querySelector('[onfocus]')).toBeNull();
  });

  it('never opens a non-http intent link, and opens an https one', async () => {
    const root = await boot(bootstrap({
      consent: { mode: 'none' },
      intents: [
        { id: 'bad', label: 'Bad', behavior: 'open_url', external_url: 'javascript:alert(1)' },
        { id: 'good', label: 'Good', behavior: 'open_url', external_url: 'https://maison.example/sizes' },
      ],
    }));
    root.querySelector<HTMLButtonElement>('[data-intent-id="bad"]')!.click();
    expect(opened).not.toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('[data-intent-id="good"]')!.click();
    expect(opened).toHaveBeenCalledWith('https://maison.example/sizes', '_blank', 'noopener');
  });
});
