import { initClerk, requireAuth, mountUserButton } from './clerk.js';
import { syncClerkUserToSupabase, getCurrentWorkspace, getWidgetSites, isSupabaseConfigured } from '../lib/clerk-supabase-sync.js';

const clerk = await initClerk();

const setupMsg = document.getElementById('app-setup-message');
const appContent = document.getElementById('app-content');

if (!clerk) {
  setupMsg.style.display = 'block';
  appContent.style.display = 'none';
} else {
  const isAuthed = requireAuth(clerk, '/sign-in.html');
  if (isAuthed) {
    setupMsg.style.display = 'none';
    appContent.style.display = 'block';

    const emailEl = document.getElementById('nav-user-email');
    if (clerk.user && clerk.user.primaryEmailAddress) {
      emailEl.textContent = clerk.user.primaryEmailAddress.emailAddress;
    }

    const settingsEmail = document.getElementById('settings-email');
    if (settingsEmail && clerk.user && clerk.user.primaryEmailAddress) {
      settingsEmail.value = clerk.user.primaryEmailAddress.emailAddress;
    }

    const settingsName = document.getElementById('settings-name');
    if (settingsName && clerk.user) {
      settingsName.value = clerk.user.fullName || clerk.user.username || '';
    }

    mountUserButton(clerk, document.getElementById('gc-user-button'));

    if (isSupabaseConfigured()) {
      const syncResult = await syncClerkUserToSupabase(clerk.user);
      if (syncResult) {
        const workspace = syncResult.workspace || await getCurrentWorkspace(syncResult.profile);
        if (workspace) {
          const sites = await getWidgetSites(workspace.id);
          window.__gcApp = {
            profile: syncResult.profile,
            workspace,
            sites,
            profileCreated: syncResult.profileCreated,
            workspaceCreated: syncResult.workspaceCreated,
          };
        }
      }
    }
  }
}

document.querySelectorAll('[data-screen], .sidebar-item[data-screen]').forEach(function(el) {
  el.addEventListener('click', function() {
    var screen = this.getAttribute('data-screen');

    document.querySelectorAll('.sidebar-item').forEach(function(s) { s.classList.remove('active'); });
    var sidebarItem = document.querySelector('.sidebar-item[data-screen="' + screen + '"]');
    if (sidebarItem) sidebarItem.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(function(n) { n.classList.remove('active'); });
    var navItem = document.querySelector('.nav-link[data-nav="' + screen + '"]');
    if (navItem) navItem.classList.add('active');

    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById('screen-' + screen);
    if (target) target.classList.add('active');
  });
});

function copySnippet() {
  var code = document.getElementById('install-snippet').textContent;
  navigator.clipboard.writeText(code).then(function() {
    var btn = document.querySelector('.snippet-copy');
    if (btn) {
      var orig = btn.innerHTML;
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.innerHTML = orig; }, 2000);
    }
  });
}

function copyEmbedKey() {
  var key = document.getElementById('embed-key-display').value;
  navigator.clipboard.writeText(key);
}
