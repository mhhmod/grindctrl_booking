import { initClerk } from './clerk.js';

const authContainer = document.getElementById('gc-auth-nav');
if (authContainer) {
  const clerk = await initClerk();

  if (!clerk) {
    authContainer.innerHTML = `
      <a href="/sign-in.html" class="gc-auth-link">Sign in</a>
      <a href="/sign-up.html" class="gc-auth-cta">Get started</a>
    `;
  } else if (clerk.isSignedIn) {
    authContainer.innerHTML = `
      <a href="/app.html" class="gc-auth-link">Dashboard</a>
      <div id="gc-user-button"></div>
    `;
    const userBtnContainer = document.getElementById('gc-user-button');
    if (userBtnContainer) {
      clerk.mountUserButton(userBtnContainer);
    }
  } else {
    authContainer.innerHTML = `
      <a href="/sign-in.html" class="gc-auth-link">Sign in</a>
      <a href="/sign-up.html" class="gc-auth-cta">Get started</a>
    `;
  }
}
