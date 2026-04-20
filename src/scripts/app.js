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

    if (settingsEmail) {
      settingsEmail.readOnly = true;
    }

    const settingsWorkspace = document.getElementById('settings-workspace');

    mountUserButton(clerk, document.getElementById('gc-user-button'));

    if (isSupabaseConfigured()) {
      try {
        const syncResult = await syncClerkUserToSupabase(clerk.user);
        if (syncResult) {
          const workspace = syncResult.workspace || await getCurrentWorkspace(syncResult.profile);
          if (workspace) {
            if (settingsWorkspace) {
              settingsWorkspace.value = workspace.name || '';
            }

            const sites = await getWidgetSites(workspace.id);

            window.__gcApp = {
              profile: syncResult.profile,
              workspace,
              sites,
              profileCreated: syncResult.profileCreated,
              workspaceCreated: syncResult.workspaceCreated,
            };

            populateDashboard(syncResult, workspace, sites);
          }
        }
      } catch (err) {
        console.error('[app] Sync error:', err);
      }
    }
  }
}

function populateDashboard(syncResult, workspace, sites) {
  const embedKeyDisplay = document.getElementById('embed-key-display');
  if (embedKeyDisplay && sites.length > 0) {
    embedKeyDisplay.value = sites[0].embed_key || 'gc_live_…';
  }

  const snippetEmbedKey = document.getElementById('snippet-embed-key');
  if (snippetEmbedKey && sites.length > 0) {
    snippetEmbedKey.textContent = sites[0].embed_key || 'gc_live_…';
  }

  const snippetDomain = document.getElementById('snippet-domain');
  if (snippetDomain && sites.length > 0 && sites[0].domain) {
    snippetDomain.textContent = sites[0].domain;
  }

  const domainList = document.getElementById('domain-list');
  if (domainList && sites.length > 0) {
    const domains = sites.flatMap(s => s.domain ? [{ name: s.domain, status: 'verified' }] : []);
    if (domains.length > 0) {
      domainList.innerHTML = domains.map(function(d) {
        return '<div class="gc-app-domain-item">' +
          '<span class="gc-app-domain-name">' + d.name + '</span>' +
          '<span class="gc-app-domain-status"><span class="status-dot status-dot--active"></span>' +
          '<span style="font-size:0.75rem;color:var(--gc-success)">Verified</span></span></div>';
      }).join('');
    }
  }

  if (sites.length === 0) {
    var installCard = document.getElementById('dash-install-card');
    if (installCard) {
      var badge = installCard.querySelector('.gc-app-badge');
      if (badge) {
        badge.className = 'gc-app-badge gc-app-badge--warning';
        badge.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">warning</span> No Domain';
      }
    }
  }
}

document.querySelectorAll('[data-screen], .gc-app-sidebar-item[data-screen]').forEach(function(el) {
  el.addEventListener('click', function() {
    var screen = this.getAttribute('data-screen');

    document.querySelectorAll('.gc-app-sidebar-item').forEach(function(s) { s.classList.remove('active'); });
    var sidebarItem = document.querySelector('.gc-app-sidebar-item[data-screen="' + screen + '"]');
    if (sidebarItem) sidebarItem.classList.add('active');

    document.querySelectorAll('.gc-app-topbar-link').forEach(function(n) { n.classList.remove('active'); });
    var navItem = document.querySelector('.gc-app-topbar-link[data-nav="' + screen + '"]');
    if (navItem) navItem.classList.add('active');

    document.querySelectorAll('.gc-app-screen').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById('screen-' + screen);
    if (target) target.classList.add('active');
  });
});

document.querySelectorAll('[data-nav]').forEach(function(el) {
  el.addEventListener('click', function() {
    var nav = this.getAttribute('data-nav');

    document.querySelectorAll('.gc-app-topbar-link').forEach(function(n) { n.classList.remove('active'); });
    var navItem = document.querySelector('.gc-app-topbar-link[data-nav="' + nav + '"]');
    if (navItem) navItem.classList.add('active');

    document.querySelectorAll('.gc-app-sidebar-item').forEach(function(s) { s.classList.remove('active'); });
    var sidebarItem = document.querySelector('.gc-app-sidebar-item[data-screen="' + nav + '"]');
    if (sidebarItem) sidebarItem.classList.add('active');

    document.querySelectorAll('.gc-app-screen').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById('screen-' + nav);
    if (target) target.classList.add('active');
  });
});

window.__copySnippet = function() {
  var code = document.getElementById('install-snippet').textContent;
  navigator.clipboard.writeText(code).then(function() {
    var btn = document.querySelector('.gc-app-snippet-copy');
    if (btn) {
      var orig = btn.innerHTML;
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.innerHTML = orig; }, 2000);
    }
  });
};

window.__copyEmbedKey = function() {
  var key = document.getElementById('embed-key-display').value;
  navigator.clipboard.writeText(key);
};