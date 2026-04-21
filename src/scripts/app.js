import { initClerk, requireAuth, mountUserButton } from './clerk.js';
import {
  syncClerkUserToSupabase,
  getCurrentWorkspace,
  getUserRole,
  isSupabaseConfigured,
  createWidgetSite,
  updateWidgetSite,
  deleteWidgetSite,
  regenerateEmbedKey,
  getWorkspaceDomains,
  addDomain,
  updateDomainStatus,
  removeDomain,
  getWidgetIntents,
  createIntent,
  updateIntent,
  deleteIntent,
  getWidgetLeads,
} from '../lib/clerk-supabase-sync.js';

const clerk = await initClerk();

const setupMsg = document.getElementById('app-setup-message');
const appContent = document.getElementById('app-content');
const inlineError = document.getElementById('app-inline-error');

// ── Global App State ──
let appState = {
  profile: null,
  workspace: null,
  sites: [],
  selectedSiteId: null,
  selectedSite: null,
  domains: [],
  intents: [],
  leads: [],
  isAdmin: false,
};

// ── Utilities ──
function showToast(message, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'gc-app-toast gc-app-toast--' + (type || 'success');
  toast.innerHTML = '<span class="material-symbols-outlined gc-icon gc-icon--sm">' +
    (type === 'error' ? 'error' : 'check_circle') + '</span> ' + escapeHtml(message);
  container.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(function () { toast.remove(); }, 300);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setLoading(el, loading) {
  if (!el) return;
  if (loading) {
    el.disabled = true;
    el.dataset.originalText = el.innerHTML;
    el.innerHTML = '<span class="material-symbols-outlined gc-icon gc-icon--sm" style="animation:spin 1s linear infinite">refresh</span>';
  } else {
    el.disabled = false;
    if (el.dataset.originalText) el.innerHTML = el.dataset.originalText;
  }
}

function showConfirmDialog(title, body, onConfirm) {
  const overlay = document.getElementById('confirm-dialog');
  const titleEl = document.getElementById('confirm-dialog-title');
  const bodyEl = document.getElementById('confirm-dialog-body');
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');

  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = body;
  if (overlay) overlay.classList.add('active');

  function cleanup() {
    if (overlay) overlay.classList.remove('active');
    okBtn.removeEventListener('click', onOk);
    cancelBtn.removeEventListener('click', onCancel);
  }

  function onOk() {
    cleanup();
    if (onConfirm) onConfirm();
  }
  function onCancel() { cleanup(); }

  okBtn.addEventListener('click', onOk);
  cancelBtn.addEventListener('click', onCancel);
}

function copyToClipboard(text, btnEl) {
  navigator.clipboard.writeText(text).then(function () {
    showToast('Copied!', 'success');
    if (btnEl) {
      const original = btnEl.innerHTML;
      btnEl.innerHTML = '<span class="material-symbols-outlined gc-icon gc-icon--sm">check</span> Copied!';
      setTimeout(function () { btnEl.innerHTML = original; }, 2000);
    }
  }).catch(function () {
    showToast('Copy failed', 'error');
  });
}

function getConfigDefaults() {
  return {
    launcher_position: 'bottom-right',
    launcher_label: 'Support',
    greeting_message: 'How can we help you today?',
    support_mode: 'mixed',
    active_state: true,
  };
}

function getBrandingDefaults() {
  return {
    brand_name: '',
    primary_color: '#4F46E5',
    accent_color: '#6366F1',
    logo_url: '',
  };
}

function getLeadCaptureDefaults() {
  return {
    enabled: false,
    timing_mode: 'disabled',
    fields_enabled: ['name', 'email'],
    prompt_text: 'Please share your details so we can assist you better.',
    deduplicate_session: true,
  };
}

function safeJsonParse(json, defaults) {
  if (!json) return defaults;
  if (typeof json === 'object') return json;
  try { return JSON.parse(json); } catch (e) { return defaults; }
}

// ── Hydrate Static Progress ──
function hydrateStaticProgress() {
  const trialBanner = document.getElementById('trial-banner');
  if (trialBanner) {
    const totalDays = Number(trialBanner.getAttribute('data-total-days')) || 15;
    const daysLeft = Number(trialBanner.getAttribute('data-days-left')) || 0;
    const percent = Math.max(0, Math.min(100, Math.round((daysLeft / totalDays) * 100)));
    const trialBar = document.getElementById('trial-progress-bar');
    const trialCopy = document.getElementById('trial-progress-copy');
    const trialDays = document.getElementById('trial-days-left');

    trialBanner.querySelector('.gc-app-trial-progress')?.setAttribute('aria-valuenow', String(percent));
    if (trialBar) trialBar.style.width = percent + '%';
    if (trialCopy) trialCopy.textContent = daysLeft + ' of ' + totalDays + ' trial days remaining';
    if (trialDays) trialDays.textContent = String(daysLeft);
  }

  const setupProgress = document.querySelector('.gc-app-setup-progress');
  if (setupProgress) {
    const completed = Number(setupProgress.getAttribute('data-completed')) || 0;
    const total = Number(setupProgress.getAttribute('data-total')) || 1;
    const percent = Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
    const setupBar = document.getElementById('setup-progress-bar');
    const setupRatio = document.getElementById('setup-progress-ratio');

    setupProgress.querySelector('.gc-app-setup-progress-track')?.setAttribute('aria-valuenow', String(percent));
    if (setupBar) setupBar.style.width = percent + '%';
    if (setupRatio) setupRatio.textContent = percent + '%';
  }
}

function setInlineError(visible) {
  if (!inlineError) return;
  inlineError.style.display = visible ? 'flex' : 'none';
}

// ── Site Selector ──
function renderSiteSelector() {
  const container = document.getElementById('site-selector-container');
  const select = document.getElementById('site-selector');
  if (!container || !select) return;

  if (appState.sites.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  select.innerHTML = '<option value="" data-i18n="ws_select_site">Select Site</option>';

  appState.sites.forEach(function (site) {
    const opt = document.createElement('option');
    opt.value = site.id;
    opt.textContent = site.name;
    if (site.id === appState.selectedSiteId) opt.selected = true;
    select.appendChild(opt);
  });
}

function selectSite(siteId) {
  if (!siteId) {
    appState.selectedSiteId = null;
    appState.selectedSite = null;
    return;
  }
  appState.selectedSiteId = siteId;
  appState.selectedSite = appState.sites.find(function (s) { return s.id === siteId; }) || null;
  populateAllScreens();
}

// ── Populate Screens ──
function populateAllScreens() {
  const site = appState.selectedSite;

  // Dashboard
  populateDashboard();

  // Setup
  const setupEmpty = document.getElementById('setup-empty-state');
  const setupContent = document.getElementById('setup-content');
  if (setupEmpty && setupContent) {
    if (!site) {
      setupEmpty.style.display = 'block';
      setupContent.style.display = 'none';
    } else {
      setupEmpty.style.display = 'none';
      setupContent.style.display = 'block';
      populateSetupScreen(site);
    }
  }

  // Domains
  populateDomainsScreen();

  // Branding
  populateBrandingScreen();

  // Intents
  populateIntentsScreen();

  // Leads
  populateLeadsScreen();
}

function populateDashboard() {
  const site = appState.selectedSite;
  const embedKeyDisplay = document.getElementById('embed-key-display');
  if (embedKeyDisplay && site) embedKeyDisplay.value = site.embed_key || '';

  const snippetEmbedKey = document.getElementById('snippet-embed-key');
  if (snippetEmbedKey && site) snippetEmbedKey.textContent = site.embed_key || 'gc_live_…';

  const snippetDomain = document.getElementById('snippet-domain');
  if (snippetDomain && site && site.domain) snippetDomain.textContent = site.domain;
}

function populateSetupScreen(site) {
  if (!site) return;

  const embedKeyDisplay = document.getElementById('embed-key-display');
  if (embedKeyDisplay) embedKeyDisplay.value = site.embed_key || '';

  const setupSnippetEmbedKey = document.getElementById('setup-snippet-embed-key');
  if (setupSnippetEmbedKey) setupSnippetEmbedKey.textContent = site.embed_key || 'gc_live_…';

  const setupSnippetDomain = document.getElementById('setup-snippet-domain');
  if (setupSnippetDomain) setupSnippetDomain.textContent = site.domain || 'yourdomain.com';

  const config = safeJsonParse(site.config_json, getConfigDefaults());

  const pos = document.getElementById('config-launcher-position');
  if (pos) pos.value = config.launcher_position || 'bottom-right';

  const label = document.getElementById('config-launcher-label');
  if (label) label.value = config.launcher_label || 'Support';

  const greeting = document.getElementById('config-greeting');
  if (greeting) greeting.value = config.greeting_message || 'How can we help you today?';

  const mode = document.getElementById('config-support-mode');
  if (mode) mode.value = config.support_mode || 'mixed';

  const active = document.getElementById('config-active-state');
  if (active) active.checked = config.active_state !== false;

  const badge = document.getElementById('setup-status-badge');
  if (badge) {
    const status = site.status || 'draft';
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    badge.className = 'gc-app-badge gc-app-badge--' + (status === 'active' ? 'success' : status === 'disabled' ? 'danger' : 'warning');
  }
}

async function populateDomainsScreen() {
  const site = appState.selectedSite;
  const list = document.getElementById('domain-list');
  if (!list) return;

  if (!site) {
    list.innerHTML = '<div class="gc-app-empty"><span class="material-symbols-outlined">language</span><div class="gc-app-empty-title" data-i18n="domains_empty_title">No domains configured</div><div class="gc-app-empty-desc" data-i18n="domains_empty_desc">Add a domain to start using your widget on your site.</div></div>';
    return;
  }

  const domains = await getWorkspaceDomains(clerk.user.id, site.id);
  appState.domains = domains;

  if (domains.length === 0) {
    list.innerHTML = '<div class="gc-app-empty"><span class="material-symbols-outlined">language</span><div class="gc-app-empty-title" data-i18n="domains_empty_title">No domains configured</div><div class="gc-app-empty-desc" data-i18n="domains_empty_desc">Add a domain to start using your widget on your site.</div></div>';
    return;
  }

  list.innerHTML = domains.map(function (d) {
    const statusClass = d.verification_status === 'verified' ? 'gc-app-badge--success' :
      d.verification_status === 'failed' ? 'gc-app-badge--danger' : 'gc-app-badge--warning';
    const statusLabel = d.verification_status === 'verified' ? 'Verified' :
      d.verification_status === 'failed' ? 'Failed' : 'Pending';
    let adminActions = '';
    if (appState.isAdmin && d.verification_status === 'pending') {
      adminActions = '<button class="gc-btn gc-btn--secondary gc-btn--sm btn-verify-domain" data-id="' + d.id + '">Verify</button>' +
        '<button class="gc-btn gc-btn--ghost gc-btn--sm btn-reject-domain" data-id="' + d.id + '">Reject</button>';
    }
    return '<div class="gc-app-domain-item">' +
      '<span class="gc-app-domain-name">' + escapeHtml(d.domain) + '</span>' +
      '<div style="display:flex;align-items:center;gap:var(--gc-space-2)">' +
      '<span class="gc-app-badge ' + statusClass + '">' + statusLabel + '</span>' +
      adminActions +
      '<button class="gc-btn gc-btn--ghost gc-btn--sm btn-remove-domain" data-id="' + d.id + '"><span class="material-symbols-outlined gc-icon gc-icon--sm">delete</span></button>' +
      '</div></div>';
  }).join('');
}

function populateBrandingScreen() {
  const site = appState.selectedSite;
  if (!site) return;

  const branding = safeJsonParse(site.branding_json, getBrandingDefaults());

  const name = document.getElementById('branding-name');
  if (name) name.value = branding.brand_name || '';

  const logoUrl = document.getElementById('branding-logo-url');
  if (logoUrl) logoUrl.value = branding.logo_url || '';

  const primary = document.getElementById('branding-primary-color');
  const primaryHex = document.getElementById('branding-primary-hex');
  if (primary) primary.value = branding.primary_color || '#4F46E5';
  if (primaryHex) primaryHex.value = branding.primary_color || '#4F46E5';

  const accent = document.getElementById('branding-accent-color');
  const accentHex = document.getElementById('branding-accent-hex');
  if (accent) accent.value = branding.accent_color || '#6366F1';
  if (accentHex) accentHex.value = branding.accent_color || '#6366F1';
}

async function populateIntentsScreen() {
  const site = appState.selectedSite;
  const list = document.getElementById('intents-list');
  if (!list) return;

  if (!site) {
    list.innerHTML = '<div class="gc-app-empty"><span class="material-symbols-outlined">flash_on</span><div class="gc-app-empty-title" data-i18n="intents_empty_title">No intents configured</div><div class="gc-app-empty-desc" data-i18n="intents_empty_desc">Add your first intent to help visitors get support faster.</div></div>';
    return;
  }

  const intents = await getWidgetIntents(clerk.user.id, site.id);
  appState.intents = intents;

  if (intents.length === 0) {
    list.innerHTML = '<div class="gc-app-empty"><span class="material-symbols-outlined">flash_on</span><div class="gc-app-empty-title" data-i18n="intents_empty_title">No intents configured</div><div class="gc-app-empty-desc" data-i18n="intents_empty_desc">Add your first intent to help visitors get support faster.</div></div>';
    return;
  }

  list.innerHTML = intents.map(function (intent) {
    const typeLabel = intent.action_type === 'escalate' ? 'Escalate' :
      intent.action_type === 'external_link' ? 'External Link' : 'Send Message';
    const typeStyle = intent.action_type === 'escalate' ? 'background:var(--gc-success-bg);color:var(--gc-success)' : '';
    return '<div class="gc-app-intent-item" data-id="' + intent.id + '">' +
      '<div class="gc-app-intent-icon"><span class="material-symbols-outlined">' + escapeHtml(intent.icon || 'chat') + '</span></div>' +
      '<div class="gc-app-intent-label">' + escapeHtml(intent.label) + '</div>' +
      '<span class="gc-app-intent-type" style="' + typeStyle + '">' + typeLabel + '</span>' +
      '<button class="gc-btn gc-btn--ghost gc-btn--sm btn-edit-intent" data-id="' + intent.id + '"><span class="material-symbols-outlined gc-icon gc-icon--sm">edit</span></button>' +
      '<button class="gc-btn gc-btn--ghost gc-btn--sm btn-delete-intent" data-id="' + intent.id + '"><span class="material-symbols-outlined gc-icon gc-icon--sm">delete</span></button>' +
      '</div>';
  }).join('');
}

async function populateLeadsScreen() {
  const site = appState.selectedSite;

  if (site) {
    const leadCapture = safeJsonParse(site.lead_capture_json, getLeadCaptureDefaults());
    const enabled = document.getElementById('lead-capture-enabled');
    if (enabled) enabled.checked = leadCapture.enabled === true;

    const timing = document.getElementById('lead-capture-timing');
    if (timing) timing.value = leadCapture.timing_mode || 'disabled';

    const fields = leadCapture.fields_enabled || ['name', 'email'];
    const nameCb = document.getElementById('lead-field-name');
    const emailCb = document.getElementById('lead-field-email');
    const phoneCb = document.getElementById('lead-field-phone');
    const companyCb = document.getElementById('lead-field-company');
    if (nameCb) nameCb.checked = fields.includes('name');
    if (emailCb) emailCb.checked = fields.includes('email');
    if (phoneCb) phoneCb.checked = fields.includes('phone');
    if (companyCb) companyCb.checked = fields.includes('company');

    const prompt = document.getElementById('lead-capture-prompt');
    if (prompt) prompt.value = leadCapture.prompt_text || '';
  }

  // Load leads list
  const workspace = appState.workspace;
  const container = document.getElementById('leads-list-container');
  if (!container || !workspace) return;

  const leads = await getWidgetLeads(clerk.user.id, workspace.id, site ? site.id : null);
  appState.leads = leads;

  if (leads.length === 0) {
    container.innerHTML = '<div class="gc-app-empty"><span class="material-symbols-outlined">group</span><div class="gc-app-empty-title" data-i18n="leads_empty_title">No leads yet</div><div class="gc-app-empty-desc" data-i18n="leads_empty_desc">Leads will appear here once visitors submit their information.</div></div>';
    return;
  }

  container.innerHTML = '<table class="gc-app-leads-table"><thead><tr>' +
    '<th data-i18n="leads_name">Name</th>' +
    '<th data-i18n="leads_email">Email</th>' +
    '<th data-i18n="leads_phone">Phone</th>' +
    '<th data-i18n="leads_company">Company</th>' +
    '<th data-i18n="leads_source">Source</th>' +
    '<th data-i18n="leads_date">Date</th>' +
    '</tr></thead><tbody>' +
    leads.map(function (l) {
      return '<tr>' +
        '<td>' + escapeHtml(l.name || '—') + '</td>' +
        '<td>' + escapeHtml(l.email || '—') + '</td>' +
        '<td>' + escapeHtml(l.phone || '—') + '</td>' +
        '<td>' + escapeHtml(l.company || '—') + '</td>' +
        '<td>' + escapeHtml(l.source_domain || '—') + '</td>' +
        '<td>' + new Date(l.created_at).toLocaleDateString() + '</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

// ── Screen Navigation ──
function navigateToScreen(screen) {
  document.querySelectorAll('.gc-app-sidebar-item').forEach(function (s) { s.classList.remove('active'); });
  var sidebarItem = document.querySelector('.gc-app-sidebar-item[data-screen="' + screen + '"]');
  if (sidebarItem) sidebarItem.classList.add('active');

  document.querySelectorAll('.gc-app-topbar-link').forEach(function (n) { n.classList.remove('active'); });
  var navItem = document.querySelector('.gc-app-topbar-link[data-nav="' + screen + '"]');
  if (navItem) navItem.classList.add('active');

  document.querySelectorAll('.gc-app-screen').forEach(function (s) { s.classList.remove('active'); });
  var target = document.getElementById('screen-' + screen);
  if (target) target.classList.add('active');
}

// ── Event Handlers ──
function initEventHandlers() {
  // Sidebar / topbar nav
  document.querySelectorAll('[data-screen], .gc-app-sidebar-item[data-screen]').forEach(function (el) {
    el.addEventListener('click', function () {
      var screen = this.getAttribute('data-screen');
      navigateToScreen(screen);
    });
  });

  document.querySelectorAll('[data-nav]').forEach(function (el) {
    el.addEventListener('click', function () {
      var nav = this.getAttribute('data-nav');
      navigateToScreen(nav);
    });
  });

  document.querySelectorAll('[data-screen-nav]').forEach(function (el) {
    el.addEventListener('click', function () {
      var screen = this.getAttribute('data-screen-nav');
      navigateToScreen(screen);
    });
  });

  // Site selector
  const siteSelector = document.getElementById('site-selector');
  if (siteSelector) {
    siteSelector.addEventListener('change', function () {
      selectSite(this.value);
    });
  }

  // Create site
  const btnCreateSite = document.getElementById('btn-create-site');
  const setupEmptyCreate = document.getElementById('setup-empty-create');
  const createSiteDialog = document.getElementById('create-site-dialog');
  const createSiteConfirm = document.getElementById('create-site-confirm');
  const createSiteCancel = document.getElementById('create-site-cancel');

  function openCreateSiteDialog() {
    if (createSiteDialog) createSiteDialog.classList.add('active');
    const input = document.getElementById('create-site-name');
    if (input) input.value = '';
  }

  function closeCreateSiteDialog() {
    if (createSiteDialog) createSiteDialog.classList.remove('active');
  }

  if (btnCreateSite) btnCreateSite.addEventListener('click', openCreateSiteDialog);
  if (setupEmptyCreate) setupEmptyCreate.addEventListener('click', openCreateSiteDialog);
  if (createSiteCancel) createSiteCancel.addEventListener('click', closeCreateSiteDialog);
  if (createSiteConfirm) {
    createSiteConfirm.addEventListener('click', async function () {
      const input = document.getElementById('create-site-name');
      const name = input ? input.value.trim() : '';
      if (!name) {
        showToast('Please enter a site name', 'error');
        return;
      }
      const profile = appState.profile;
      const workspace = appState.workspace;
      if (!profile || !workspace) {
        showToast('Workspace not ready', 'error');
        return;
      }
      setLoading(createSiteConfirm, true);
      const site = await createWidgetSite(clerk.user.id, workspace.id, name);
      setLoading(createSiteConfirm, false);
      if (site) {
        appState.sites.unshift(site);
        renderSiteSelector();
        selectSite(site.id);
        closeCreateSiteDialog();
        showToast('Widget site created', 'success');
      } else {
        showToast('Failed to create site', 'error');
      }
    });
  }

  // Copy embed key
  const btnCopyEmbedKey = document.getElementById('btn-copy-embed-key');
  if (btnCopyEmbedKey) {
    btnCopyEmbedKey.addEventListener('click', function () {
      const key = document.getElementById('embed-key-display');
      if (key && key.value) copyToClipboard(key.value, btnCopyEmbedKey);
    });
  }

  // Copy snippet
  const btnCopySnippet = document.getElementById('btn-copy-snippet');
  if (btnCopySnippet) {
    btnCopySnippet.addEventListener('click', function () {
      const site = appState.selectedSite;
      if (!site) return;
      const snippet = '<script src="https://cdn.grindctrl.com/grindctrl-support.js"><\/script>\n<script>\n  GrindctrlSupport.init({\n    embedKey: "' + site.embed_key + '",\n    domain: window.location.hostname\n  });\n<\/script>';
      copyToClipboard(snippet, btnCopySnippet);
    });
  }

  // Save config
  const btnSaveConfig = document.getElementById('btn-save-config');
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', async function () {
      const site = appState.selectedSite;
      if (!site) return;
      const config = {
        launcher_position: document.getElementById('config-launcher-position').value,
        launcher_label: document.getElementById('config-launcher-label').value,
        greeting_message: document.getElementById('config-greeting').value,
        support_mode: document.getElementById('config-support-mode').value,
        active_state: document.getElementById('config-active-state').checked,
      };
      setLoading(btnSaveConfig, true);
      const updated = await updateWidgetSite(clerk.user.id, site.id, { config_json: config });
      setLoading(btnSaveConfig, false);
      if (updated) {
        appState.selectedSite = updated;
        const idx = appState.sites.findIndex(function (s) { return s.id === updated.id; });
        if (idx >= 0) appState.sites[idx] = updated;
        showToast('Changes saved', 'success');
      } else {
        showToast('Failed to save', 'error');
      }
    });
  }

  // Save branding
  const btnSaveBranding = document.getElementById('btn-save-branding');
  if (btnSaveBranding) {
    btnSaveBranding.addEventListener('click', async function () {
      const site = appState.selectedSite;
      if (!site) return;
      const branding = {
        brand_name: document.getElementById('branding-name').value,
        logo_url: document.getElementById('branding-logo-url').value,
        primary_color: document.getElementById('branding-primary-color').value,
        accent_color: document.getElementById('branding-accent-color').value,
      };
      setLoading(btnSaveBranding, true);
      const updated = await updateWidgetSite(clerk.user.id, site.id, { branding_json: branding });
      setLoading(btnSaveBranding, false);
      if (updated) {
        appState.selectedSite = updated;
        const idx = appState.sites.findIndex(function (s) { return s.id === updated.id; });
        if (idx >= 0) appState.sites[idx] = updated;
        showToast('Branding saved', 'success');
      } else {
        showToast('Failed to save branding', 'error');
      }
    });
  }

  // Color pickers sync with text inputs
  const primaryColor = document.getElementById('branding-primary-color');
  const primaryHex = document.getElementById('branding-primary-hex');
  if (primaryColor && primaryHex) {
    primaryColor.addEventListener('input', function () { primaryHex.value = this.value; });
    primaryHex.addEventListener('change', function () { primaryColor.value = this.value; });
  }
  const accentColor = document.getElementById('branding-accent-color');
  const accentHex = document.getElementById('branding-accent-hex');
  if (accentColor && accentHex) {
    accentColor.addEventListener('input', function () { accentHex.value = this.value; });
    accentHex.addEventListener('change', function () { accentColor.value = this.value; });
  }

  // Domains
  const btnAddDomain = document.getElementById('btn-add-domain');
  const addDomainForm = document.getElementById('add-domain-form');
  const btnConfirmAddDomain = document.getElementById('btn-confirm-add-domain');

  if (btnAddDomain && addDomainForm) {
    btnAddDomain.addEventListener('click', function () {
      addDomainForm.style.display = addDomainForm.style.display === 'none' ? 'block' : 'none';
    });
  }

  if (btnConfirmAddDomain) {
    btnConfirmAddDomain.addEventListener('click', async function () {
      const site = appState.selectedSite;
      const input = document.getElementById('domain-input');
      if (!site || !input) return;
      const domain = input.value.trim();
      if (!domain) {
        showToast('Please enter a domain', 'error');
        return;
      }
      setLoading(btnConfirmAddDomain, true);
      const result = await addDomain(clerk.user.id, site.id, domain);
      setLoading(btnConfirmAddDomain, false);
      if (result) {
        input.value = '';
        addDomainForm.style.display = 'none';
        await populateDomainsScreen();
        showToast('Domain added', 'success');
      } else {
        showToast('Failed to add domain', 'error');
      }
    });
  }

  // Domain list actions (delegated)
  const domainList = document.getElementById('domain-list');
  if (domainList) {
    domainList.addEventListener('click', async function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const domainId = btn.getAttribute('data-id');
      if (!domainId) return;

      if (btn.classList.contains('btn-verify-domain')) {
        const result = await updateDomainStatus(clerk.user.id, domainId, 'verified');
        if (result) {
          await populateDomainsScreen();
          showToast('Domain verified', 'success');
        }
      } else if (btn.classList.contains('btn-reject-domain')) {
        const result = await updateDomainStatus(clerk.user.id, domainId, 'failed');
        if (result) {
          await populateDomainsScreen();
          showToast('Domain rejected', 'success');
        }
      } else if (btn.classList.contains('btn-remove-domain')) {
        showConfirmDialog('Remove Domain?', 'This domain will no longer be able to host the widget.', async function () {
          const ok = await removeDomain(clerk.user.id, domainId);
          if (ok) {
            await populateDomainsScreen();
            showToast('Domain removed', 'success');
          } else {
            showToast('Failed to remove domain', 'error');
          }
        });
      }
    });
  }

  // Regenerate embed key
  const btnRegenerateKey = document.getElementById('btn-regenerate-key');
  if (btnRegenerateKey) {
    btnRegenerateKey.addEventListener('click', function () {
      const site = appState.selectedSite;
      if (!site) return;
      showConfirmDialog('Regenerate Embed Key?', 'This will invalidate the current key. The widget will stop working on sites using the old key.', async function () {
        setLoading(btnRegenerateKey, true);
        const updated = await regenerateEmbedKey(clerk.user.id, site.id);
        setLoading(btnRegenerateKey, false);
        if (updated) {
          appState.selectedSite = updated;
          const idx = appState.sites.findIndex(function (s) { return s.id === updated.id; });
          if (idx >= 0) appState.sites[idx] = updated;
          populateAllScreens();
          showToast('Embed key regenerated', 'success');
        } else {
          showToast('Failed to regenerate key', 'error');
        }
      });
    });
  }

  // Intents
  const btnAddIntent = document.getElementById('btn-add-intent');
  const intentFormCard = document.getElementById('intent-form-card');
  const btnCancelIntent = document.getElementById('btn-cancel-intent');
  const btnSaveIntent = document.getElementById('btn-save-intent');
  const intentActionType = document.getElementById('intent-action-type');
  const intentExternalUrlGroup = document.getElementById('intent-external-url-group');
  let editingIntentId = null;

  if (intentActionType && intentExternalUrlGroup) {
    intentActionType.addEventListener('change', function () {
      intentExternalUrlGroup.style.display = this.value === 'external_link' ? 'block' : 'none';
    });
  }

  function openIntentForm(intent) {
    editingIntentId = intent ? intent.id : null;
    const title = document.getElementById('intent-form-title');
    if (title) title.textContent = intent ? 'Edit Intent' : 'Add Intent';

    document.getElementById('intent-label').value = intent ? intent.label : '';
    document.getElementById('intent-icon').value = intent ? intent.icon || 'chat' : 'chat';
    document.getElementById('intent-action-type').value = intent ? intent.action_type : 'send_message';
    document.getElementById('intent-sort-order').value = intent ? intent.sort_order : 0;
    document.getElementById('intent-message-text').value = intent ? intent.message_text || '' : '';
    document.getElementById('intent-external-url').value = intent ? intent.external_url || '' : '';
    if (intentExternalUrlGroup) {
      intentExternalUrlGroup.style.display = intent && intent.action_type === 'external_link' ? 'block' : 'none';
    }

    if (intentFormCard) intentFormCard.style.display = 'block';
    if (intentFormCard) intentFormCard.scrollIntoView({ behavior: 'smooth' });
  }

  function closeIntentForm() {
    editingIntentId = null;
    if (intentFormCard) intentFormCard.style.display = 'none';
  }

  if (btnAddIntent) btnAddIntent.addEventListener('click', function () { openIntentForm(null); });
  if (btnCancelIntent) btnCancelIntent.addEventListener('click', closeIntentForm);

  if (btnSaveIntent) {
    btnSaveIntent.addEventListener('click', async function () {
      const site = appState.selectedSite;
      if (!site) return;
      const intent = {
        label: document.getElementById('intent-label').value.trim(),
        icon: document.getElementById('intent-icon').value.trim(),
        action_type: document.getElementById('intent-action-type').value,
        message_text: document.getElementById('intent-message-text').value.trim(),
        external_url: document.getElementById('intent-external-url').value.trim(),
        sort_order: parseInt(document.getElementById('intent-sort-order').value) || 0,
      };
      if (!intent.label) {
        showToast('Label is required', 'error');
        return;
      }
      setLoading(btnSaveIntent, true);
      let result;
      if (editingIntentId) {
        result = await updateIntent(clerk.user.id, editingIntentId, intent);
      } else {
        result = await createIntent(clerk.user.id, site.id, intent);
      }
      setLoading(btnSaveIntent, false);
      if (result) {
        closeIntentForm();
        await populateIntentsScreen();
        showToast(editingIntentId ? 'Intent updated' : 'Intent created', 'success');
      } else {
        showToast('Failed to save intent', 'error');
      }
    });
  }

  // Intent list actions (delegated)
  const intentsList = document.getElementById('intents-list');
  if (intentsList) {
    intentsList.addEventListener('click', async function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const intentId = btn.getAttribute('data-id');
      if (!intentId) return;

      if (btn.classList.contains('btn-edit-intent')) {
        const intent = appState.intents.find(function (i) { return i.id === intentId; });
        if (intent) openIntentForm(intent);
      } else if (btn.classList.contains('btn-delete-intent')) {
        showConfirmDialog('Delete Intent?', 'This action cannot be undone.', async function () {
          const ok = await deleteIntent(intentId);
          if (ok) {
            await populateIntentsScreen();
            showToast('Intent deleted', 'success');
          } else {
            showToast('Failed to delete intent', 'error');
          }
        });
      }
    });
  }

  // Save lead capture
  const btnSaveLeadCapture = document.getElementById('btn-save-lead-capture');
  if (btnSaveLeadCapture) {
    btnSaveLeadCapture.addEventListener('click', async function () {
      const site = appState.selectedSite;
      if (!site) return;
      const fields = [];
      if (document.getElementById('lead-field-name').checked) fields.push('name');
      if (document.getElementById('lead-field-email').checked) fields.push('email');
      if (document.getElementById('lead-field-phone').checked) fields.push('phone');
      if (document.getElementById('lead-field-company').checked) fields.push('company');
      const leadCapture = {
        enabled: document.getElementById('lead-capture-enabled').checked,
        timing_mode: document.getElementById('lead-capture-timing').value,
        fields_enabled: fields,
        prompt_text: document.getElementById('lead-capture-prompt').value,
        deduplicate_session: true,
      };
      setLoading(btnSaveLeadCapture, true);
      const updated = await updateWidgetSite(clerk.user.id, site.id, { lead_capture_json: leadCapture });
      setLoading(btnSaveLeadCapture, false);
      if (updated) {
        appState.selectedSite = updated;
        const idx = appState.sites.findIndex(function (s) { return s.id === updated.id; });
        if (idx >= 0) appState.sites[idx] = updated;
        showToast('Lead capture settings saved', 'success');
      } else {
        showToast('Failed to save', 'error');
      }
    });
  }
}

// ── Global Copy Functions ──
window.__copySnippet = function () {
  const site = appState.selectedSite;
  if (!site) return;
  const snippet = '<script src="https://cdn.grindctrl.com/grindctrl-support.js"><\/script>\n<script>\n  GrindctrlSupport.init({\n    embedKey: "' + site.embed_key + '",\n    domain: window.location.hostname\n  });\n<\/script>';
  navigator.clipboard.writeText(snippet).then(function () {
    var btn = document.querySelector('.gc-app-snippet-copy');
    if (btn) {
      var orig = btn.innerHTML;
      btn.innerHTML = '<span class="material-symbols-outlined">check</span> Copied!';
      setTimeout(function () { btn.innerHTML = orig; }, 2000);
    }
  });
};

window.__copyEmbedKey = function () {
  var key = document.getElementById('embed-key-display');
  if (key && key.value) navigator.clipboard.writeText(key.value);
};

// ── Auth Boot ──
if (!clerk) {
  setupMsg.style.display = 'block';
  appContent.style.display = 'none';
} else {
  const isAuthed = requireAuth(clerk, '/sign-in.html');
  if (isAuthed) {
    setupMsg.style.display = 'none';
    appContent.style.display = 'block';

    const emailEl = document.getElementById('nav-user-email');
    if (emailEl && clerk.user && clerk.user.primaryEmailAddress) {
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

    if (settingsEmail) settingsEmail.readOnly = true;

    const settingsWorkspace = document.getElementById('settings-workspace');

    mountUserButton(clerk, document.getElementById('gc-user-button'));

    if (isSupabaseConfigured()) {
      try {
        const syncResult = await syncClerkUserToSupabase(clerk.user);
        if (syncResult) {
          const workspaceBundle = await getCurrentWorkspace(clerk.user.id);
          const workspace = workspaceBundle?.workspace || syncResult.workspace || null;
          const sites = workspaceBundle?.sites || [];

          if (workspace) {
            if (settingsWorkspace) settingsWorkspace.value = workspace.name || '';

            // Check if user is admin/owner
            let isAdmin = false;
            try {
              const role = await getUserRole(clerk.user.id, workspace.id);
              if (role) {
                isAdmin = role === 'owner' || role === 'admin';
              }
            } catch (e) {
              // Fallback: assume admin if they own the workspace
              isAdmin = workspace.owner_profile_id === syncResult.profile.id;
            }

            appState = {
              profile: syncResult.profile,
              workspace,
              sites,
              selectedSiteId: sites.length > 0 ? sites[0].id : null,
              selectedSite: sites.length > 0 ? sites[0] : null,
              domains: [],
              intents: [],
              leads: [],
              isAdmin,
            };

            window.__gcApp = {
              profile: syncResult.profile,
              workspace,
              sites,
              profileCreated: syncResult.profileCreated,
              workspaceCreated: syncResult.workspaceCreated,
            };

            renderSiteSelector();
            populateAllScreens();
            initEventHandlers();
            setInlineError(false);
          } else {
            setInlineError(true);
          }
        } else {
          setInlineError(true);
        }
      } catch (err) {
        console.error('[app] Sync error:', err);
        setInlineError(true);
      }
    } else {
      setInlineError(true);
    }
  }
}

hydrateStaticProgress();
