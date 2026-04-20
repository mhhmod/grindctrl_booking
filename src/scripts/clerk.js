import { Clerk } from '@clerk/clerk-js';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

let clerkInstance = null;
let initPromise = null;

export async function initClerk() {
  if (initPromise) return initPromise;

  if (!publishableKey) {
    initPromise = Promise.resolve(null);
    return initPromise;
  }

  initPromise = (async () => {
    const clerkDomain = atob(publishableKey.split('_')[2]).slice(0, -1);

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://${clerkDomain}/npm/@clerk/ui@1/dist/ui.browser.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load @clerk/ui bundle'));
      document.head.appendChild(script);
    });

    const clerk = new Clerk(publishableKey);
    await clerk.load({
      ui: { ClerkUI: window.__internal_ClerkUICtor },
    });

    clerkInstance = clerk;
    return clerk;
  })();

  return initPromise;
}

export function requireAuth(clerk, redirectTo = '/sign-in.html') {
  if (!clerk) {
    window.location.href = redirectTo;
    return false;
  }
  if (!clerk.isSignedIn) {
    const redirectUrl = `${window.location.origin}${window.location.pathname}`;
    window.location.href = `${redirectTo}?redirect_url=${encodeURIComponent(redirectUrl)}`;
    return false;
  }
  return true;
}

export function mountUserButton(clerk, container) {
  if (!clerk || !clerk.isSignedIn || !container) return;
  clerk.mountUserButton(container);
}

export function getClerkInstance() {
  return clerkInstance;
}
