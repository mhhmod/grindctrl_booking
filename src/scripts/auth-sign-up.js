import { initClerk } from './clerk.js';
import { GRINDCTRL_APPEARANCE } from './clerk-appearance.js';

const clerk = await initClerk();

if (!clerk) {
  const mount = document.getElementById('clerk-sign-up-mount') || document.getElementById('clerk-sign-in-mount');
  if (mount) {
    mount.innerHTML = `
      <div class="gc-auth-fallback">
        <div style="font-size:48px;color:var(--gc-warning);display:block;margin-bottom:var(--gc-space-4)">⚠️</div>
        <p style="color:var(--gc-secondary);margin-bottom:var(--gc-space-4)">Authentication is not configured.</p>
        <a href="/" class="gc-btn gc-btn--secondary">Return to home</a>
      </div>
    `;
  }
} else if (clerk.isSignedIn) {
  window.location.href = '/app.html';
} else {
  const mountEl = document.getElementById('clerk-sign-up-mount') || document.getElementById('clerk-sign-in-mount');
  if (mountEl) {
    const method = mountEl.id === 'clerk-sign-up-mount' ? 'mountSignUp' : 'mountSignIn';
    clerk[method](mountEl, {
      appearance: GRINDCTRL_APPEARANCE,
      signInUrl: '/sign-in.html',
      signUpUrl: '/sign-up.html',
      afterSignInUrl: '/app.html',
      afterSignUpUrl: '/app.html',
    });
  }
}
