import { initClerk } from './clerk.js';

const clerk = await initClerk();

if (!clerk) {
  document.getElementById('clerk-sign-in-mount').innerHTML = `
    <div style="text-align:center;padding:3rem 1rem">
      <p style="color:var(--gc-auth-text-muted);margin-bottom:1rem">Authentication is not configured.</p>
      <a href="/" style="color:var(--gc-auth-accent)">Return to home</a>
    </div>
  `;
} else if (clerk.isSignedIn) {
  window.location.href = '/app.html';
} else {
  clerk.mountSignIn(document.getElementById('clerk-sign-in-mount'));
}
