import type { TryOnAttempt } from './types';

type Binding = NonNullable<TryOnAttempt['turnstile']>;
type Turnstile = {
  render: (element: HTMLElement, options: {
    sitekey: string; action: string; cData: string; appearance: 'interaction-only'; execution: 'execute';
    callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void; 'timeout-callback': () => void;
    'before-interactive-callback': () => void;
  }) => string;
  execute: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

/** The challenge itself did not finish (script blocked or offline, rejected,
 *  expired or timed out). Retrying can help, unlike a missing site key. */
export class TurnstileChallengeError extends Error {
  constructor() {
    super('turnstile_challenge_failed');
    this.name = 'TurnstileChallengeError';
  }
}

let loading: Promise<Turnstile> | undefined;
function load(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => { script.remove(); reject(new Error('turnstile_unavailable')); }, 15000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('turnstile_unavailable'));
    };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('turnstile_unavailable')); };
    document.head.appendChild(script);
  }).catch((error: unknown) => { loading = undefined; throw error; });
  return loading;
}

/* Each action runs only on the page our server verifies it for. */
const ACTION_PAGES: Record<Binding['action'], string> = { paste_tryon: '/embed/try-on', demo_tryon: '/try-on' };

/** Only the server's pasted-install and public-demo attempts carry a binding.
 * Never preload for the Shopify app/Woo or trust a query parameter to decide
 * challenge exemptions. siteKey is read at runtime on the server
 * (TURNSTILE_SITE_KEY) and returned by the attempt route. */
export async function attemptTurnstileToken(binding: TryOnAttempt['turnstile']): Promise<string | undefined> {
  if (!binding) return undefined;
  if (!binding.siteKey || !Object.hasOwn(ACTION_PAGES, binding.action) || !binding.cData
    || window.location.pathname !== ACTION_PAGES[binding.action]) {
    throw new Error('turnstile_unavailable');
  }
  return token(binding);
}

async function token(binding: Binding): Promise<string> {
  const api = await load().catch(() => { throw new TurnstileChallengeError(); });
  const container = document.createElement('div');
  // Inside our embed. Interaction-only widgets must be allowed to become visible.
  (document.querySelector('main') ?? document.body).appendChild(container);
  return new Promise<string>((resolve, reject) => {
    let widget: string | undefined;
    const finish = (value?: string) => {
      clearTimeout(timer);
      if (widget !== undefined) api.remove(widget);
      container.remove();
      if (value) resolve(value); else reject(new TurnstileChallengeError());
    };
    const timer = window.setTimeout(() => finish(), 120000);
    try {
      widget = api.render(container, { sitekey: binding.siteKey!, action: binding.action, cData: binding.cData,
        appearance: 'interaction-only', execution: 'execute', callback: finish,
        'error-callback': () => finish(), 'expired-callback': () => finish(), 'timeout-callback': () => finish(),
        // Rare: Cloudflare needs the shopper. Bring the challenge into view in the sheet.
        'before-interactive-callback': () => container.scrollIntoView?.({ block: 'center' }) });
      api.execute(widget);
    } catch { finish(); }
  });
}
