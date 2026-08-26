/**
 * GRINDCTRL Embeddable Support Widget (Runtime)
 * Version: 1.0.0
 *
 * Shadow DOM runtime that boots via Edge Functions:
 * - widget-bootstrap (public)
 * - widget-session-start (bearer)
 * - widget-message-send (bearer)
 * - widget-message-poll (bearer)
 * - widget-lead-submit (bearer)
 * - widget-event (bearer)
 */
(function (window, document) {
  'use strict';

  var VERSION = '1.0.0';
  var DEFAULT_API_BASE = 'https://egvdxshlbcqndrcnzcdn.supabase.co';

  var STORAGE = {
    visitorId: 'gc_visitor',
    conversationIdPrefix: 'gc_conv:',
    bootstrapCachePrefix: 'gc_bootstrap:'
  };

  function nowMs() { return Date.now(); }

  function warn(msg) {
    try { console.warn('[GrindctrlSupport]', msg); } catch (e) {}
  }

  function errLog(msg, err) {
    try { console.error('[GrindctrlSupport]', msg, err || ''); } catch (e) {}
  }

  function uid() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, function () {
      return Math.floor(Math.random() * 16).toString(16);
    });
  }

  function getVisitorId() {
    try {
      var stored = localStorage.getItem(STORAGE.visitorId);
      if (stored) return stored;
      var id = uid();
      localStorage.setItem(STORAGE.visitorId, id);
      return id;
    } catch (e) {
      return uid();
    }
  }

  function getConversationStorageKey(embedKey) {
    return STORAGE.conversationIdPrefix + String(embedKey || '');
  }

  function getConversationId(embedKey) {
    try { return sessionStorage.getItem(getConversationStorageKey(embedKey)); } catch (e) { return null; }
  }

  function setConversationId(embedKey, id) {
    try { sessionStorage.setItem(getConversationStorageKey(embedKey), id); } catch (e) {}
  }

  function getBootstrapCacheKey(embedKey, origin) {
    return STORAGE.bootstrapCachePrefix + String(embedKey || '') + ':' + String(origin || '');
  }

  function getOrigin() {
    try { return window.location.origin; } catch (e) { return null; }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function normalizeLang(value) {
    return String(value || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en';
  }

  function currentLang() {
    return normalizeLang(document.documentElement.getAttribute('lang') || 'en');
  }

  function t(key) {
    var dict = {
      en: {
        greeting_default: 'How can we help you today?',
        placeholder: 'Type your message…',
        send: 'Send',
        close: 'Close',
        minimize: 'Minimize',
        powered_by: 'Powered by GRINDCTRL',
        error: 'Something went wrong. Please try again.',
        offline_title: 'Connection issue detected',
        offline_desc: 'The chat shell is still available. Try again in a moment.',
        retry: 'Retry',
        // Lead capture
        lead_capture_title: 'Before we start',
        lead_capture_subtitle: 'Tell us a bit about yourself',
        lead_capture_name: 'Full name',
        lead_capture_email: 'Work email',
        lead_capture_phone: 'Phone number',
        lead_capture_company: 'Company name',
        lead_capture_submit: 'Start chatting',
        lead_capture_skip: 'Skip for now',
        lead_capture_name_error: 'Please enter your name',
        lead_capture_email_error: 'Please enter a valid email',
        lead_capture_phone_error: 'Please enter a valid phone number',
        lead_capture_company_error: 'Please enter your company name',
        consent_label: 'I agree to the privacy policy'
      },
      ar: {
        greeting_default: 'كيف يمكننا مساعدتك اليوم؟',
        placeholder: 'اكتب رسالتك…',
        send: 'إرسال',
        close: 'إغلاق',
        minimize: 'تصغير',
        powered_by: 'مدعوم من GRINDCTRL',
        error: 'حدث خطأ ما. يرجى المحاولة مرة أخرى.',
        offline_title: 'تم رصد مشكلة في الاتصال',
        offline_desc: 'واجهة المحادثة ما زالت متاحة. حاول مرة أخرى بعد لحظة.',
        retry: 'إعادة المحاولة',
        // Lead capture
        lead_capture_title: 'قبل البدء',
        lead_capture_subtitle: 'عرّفنا بنفسك قليلاً',
        lead_capture_name: 'الاسم الكامل',
        lead_capture_email: 'البريد الإلكتروني',
        lead_capture_phone: 'رقم الهاتف',
        lead_capture_company: 'اسم الشركة',
        lead_capture_submit: 'ابدأ المحادثة',
        lead_capture_skip: 'تخطي الآن',
        lead_capture_name_error: 'يرجى إدخال اسمك',
        lead_capture_email_error: 'يرجى إدخال بريد إلكتروني صحيح',
        lead_capture_phone_error: 'يرجى إدخال رقم هاتف صحيح',
        lead_capture_company_error: 'يرجى إدخال اسم الشركة',
        consent_label: 'أوافق على سياسة الخصوصية'
      }
    };
    var lang = currentLang();
    return (dict[lang] && dict[lang][key]) || dict.en[key] || key;
  }

  function withTimeout(ms) {
    var ctrl = new AbortController();
    var id = setTimeout(function () { ctrl.abort(); }, ms);
    return { signal: ctrl.signal, cancel: function () { clearTimeout(id); } };
  }

  function fnUrl(fnName) {
    return DEFAULT_API_BASE + '/functions/v1/' + fnName;
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Runtime state
  // ─────────────────────────────────────────────────────────────

  var state = {
    phase: 'idle',
    init: null,
    effective: null,
    token: null,
    tokenExpiresAt: 0,
    bootstrapTried: false,
    offlineMode: false,

    conversationId: null,
    lastSeenCreatedAt: null,
    pollTimer: null,
    pollIntervalMs: 1500,
    pollMaxMs: 6000,
    pendingPoll: false,

    // Lead capture
    leadCaptured: false,
    leadCaptureActive: false,
    messageCount: 0,
    lastIntentId: null,

    // Shadow DOM
    host: null,
    shadow: null,
    container: null
  };

  // ─────────────────────────────────────────────────────────────
  // Configuration mapping
  // ─────────────────────────────────────────────────────────────

  function mapEffectiveConfig(bootstrap) {
    var site = bootstrap && bootstrap.site ? bootstrap.site : null;
    if (!site) return null;

    var branding = site.branding || {};
    var widget = site.widget || {};
    var leads = site.leads || {};

    return {
      siteId: site.id,
      name: site.name || '',

      branding: {
        brandName: branding.brand_name || site.name || 'Support',
        assistantName: branding.assistant_name || 'Support',
        logoUrl: branding.logo_url || '',
        avatarUrl: branding.avatar_url || '',
        launcherLabel: branding.launcher_label || 'Support',
        launcherIcon: branding.launcher_icon || 'chat',
        themeMode: branding.theme_mode || 'auto',
        radiusStyle: branding.radius_style || 'soft',
        attribution: {
          mode: (branding.attribution && branding.attribution.mode) || 'auto',
          showPoweredBy: (branding.attribution && branding.attribution.show_powered_by) !== false
        }
      },

      widget: {
        position: widget.position || 'bottom-right',
        defaultOpen: widget.default_open === true,
        showIntents: widget.show_intents !== false,
        rtlSupported: widget.rtl_supported !== false,
        locale: widget.locale || 'auto'
      },

      leads: {
        enabled: leads.enabled === true,
        captureTiming: leads.capture_timing || 'off',
        fields: Array.isArray(leads.fields) ? leads.fields : [],
        requiredFields: Array.isArray(leads.required_fields) ? leads.required_fields : [],
        promptTitle: leads.prompt_title || '',
        promptSubtitle: leads.prompt_subtitle || '',
        skippable: leads.skippable === true,
        consent: leads.consent || { mode: 'none', text: '', privacy_url: '' }
      },

      intents: Array.isArray(site.intents) ? site.intents : []
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Bootstrap + auth
  // ─────────────────────────────────────────────────────────────

  function storeBootstrapCache(embedKey, origin, bootstrap) {
    try {
      sessionStorage.setItem(getBootstrapCacheKey(embedKey, origin), JSON.stringify({
        at: nowMs(),
        bootstrap: bootstrap
      }));
    } catch (e) {}
  }

  function loadBootstrapCache(embedKey, origin) {
    try {
      var raw = sessionStorage.getItem(getBootstrapCacheKey(embedKey, origin));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.bootstrap ? parsed.bootstrap : null;
    } catch (e) {
      return null;
    }
  }

  function tokenValid() {
    return !!(state.token && state.tokenExpiresAt && state.tokenExpiresAt > nowMs() + 5000);
  }

  function authHeaders() {
    var h = {
      'Content-Type': 'application/json',
      'x-grindctrl-widget-version': VERSION
    };
    if (state.token) h['Authorization'] = 'Bearer ' + state.token;
    return h;
  }

  function callWidget(fnName, body, opts) {
    opts = opts || {};

    var attempt = function () {
      var to = withTimeout(opts.timeoutMs || 6000);
      return fetchJson(fnUrl(fnName), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body || {}),
        signal: to.signal,
        credentials: 'omit',
        mode: 'cors'
      }).finally(function () {
        to.cancel();
      });
    };

    return attempt().then(function (res) {
      if (res.status === 401 && !opts.noRebootstrap) {
        // Token expired or invalid. Try to bootstrap again once.
        return bootstrapOnce({ force: true }).then(function (ok) {
          if (!ok) return res;
          return attempt();
        });
      }
      return res;
    });
  }

  function bootstrapOnce(options) {
    options = options || {};
    if (state.bootstrapTried && !options.force) return Promise.resolve(!!state.effective);

    state.bootstrapTried = true;

    var origin = getOrigin();
    if (!origin) return Promise.resolve(false);

    var init = state.init;
    if (!init || !init.embedKey) return Promise.resolve(false);

    var body = {
      embedKey: init.embedKey,
      page: { url: init.context.pageUrl || window.location.href, title: document.title || '' },
      locale: init.locale || 'auto',
      user: init.user || { id: null, email: null, name: null },
      context: init.context || { custom: {} }
    };

    var attemptNum = 0;
    function attempt() {
      attemptNum++;
      var to = withTimeout(6000);
      return fetchJson(fnUrl('widget-bootstrap'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-grindctrl-widget-version': VERSION },
        body: JSON.stringify(body),
        signal: to.signal,
        credentials: 'omit',
        mode: 'cors'
      }).finally(function () { to.cancel(); });
    }

    return attempt().then(function (res) {
      if (res.ok && res.data && res.data.ok) {
        state.offlineMode = false;
        state.token = res.data.auth && res.data.auth.embed_session_token;
        state.tokenExpiresAt = nowMs() + ((res.data.auth && res.data.auth.expires_in_sec ? res.data.auth.expires_in_sec : 3600) * 1000);
        state.pollIntervalMs = res.data.polling && res.data.polling.min_interval_ms ? res.data.polling.min_interval_ms : 1500;
        state.pollMaxMs = res.data.polling && res.data.polling.max_interval_ms ? res.data.polling.max_interval_ms : 6000;
        state.effective = mapEffectiveConfig(res.data);

        storeBootstrapCache(init.embedKey, origin, res.data);

        return true;
      }

      // Explicit invalid key returned with JSON (CORS allowed)
      if (res.data && res.data.error === 'embed_key_invalid') {
        raiseError({ code: 'embed_key_invalid', message: 'Invalid embed key.' });
        return false;
      }

      return false;
    }).catch(function (e) {
      // Likely CORS/domain rejection or network failure.
      if (init.debug) errLog('Bootstrap failed', e);
      return false;
    }).then(function (ok) {
      if (ok) {
        // Heartbeat (best-effort)
        sendEvent('widget_heartbeat', {
          page_url: init.context.pageUrl || window.location.href
        });
        return true;
      }

      // Offline fallback only if we have previously verified cached config for this origin.
      var cached = loadBootstrapCache(init.embedKey, origin);
      if (cached && cached.ok) {
        state.offlineMode = true;
        state.effective = mapEffectiveConfig(cached);
        // No token in offline mode.
        state.token = null;
        state.tokenExpiresAt = 0;
        return true;
      }

      // If we cannot bootstrap and have no cache, do not render.
      warn('Widget could not bootstrap. It will not render.');
      raiseError({ code: 'bootstrap_failed', message: 'Bootstrap failed.' });
      return false;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Shadow DOM UI
  // ─────────────────────────────────────────────────────────────

  var ICONS = {
    chat: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    send: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
    expand_less: 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z'
  };

  function iconSvg(path) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="' + path + '"/></svg>';
  }

  function buildStyles(cfg) {
    var isRtl = currentLang() === 'ar';
    var pos = (cfg && cfg.widget && cfg.widget.position) ? cfg.widget.position : 'bottom-right';

    var inset = {
      top: null,
      bottom: null,
      left: null,
      right: null
    };

    if (pos === 'bottom-left') { inset.bottom = '20px'; inset.left = '20px'; }
    else if (pos === 'top-right') { inset.top = '20px'; inset.right = '20px'; }
    else if (pos === 'top-left') { inset.top = '20px'; inset.left = '20px'; }
    else { inset.bottom = '20px'; inset.right = '20px'; }

    // If page is RTL and position is right/left, keep explicit position.
    // For legacy RTL behavior, we still align panel origin logically.
    var hostPos = [
      ':host {',
      '  all: initial;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  --gc-bg: #0F0F0F;',
      '  --gc-text: #FAFAFA;',
      '  --gc-primary: #4F46E5;',
      '  --gc-accent: #6366F1;',
      '  --gc-radius: 16px;',
      '  --gc-shadow: 0 24px 64px -12px rgba(0,0,0,0.5);',
      '  position: fixed;',
      '  z-index: 2147483647;',
      (inset.top ? '  top: ' + inset.top + ';' : ''),
      (inset.bottom ? '  bottom: ' + inset.bottom + ';' : ''),
      (inset.left ? '  left: ' + inset.left + ';' : ''),
      (inset.right ? '  right: ' + inset.right + ';' : ''),
      '  display: block;',
      '  box-sizing: border-box;',
      '}',
    ].join('\n');

    return [
      hostPos,
      '.gc-launcher {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  cursor: pointer;',
      '  border: none;',
      '  background: var(--gc-primary);',
      '  color: #fff;',
      '  border-radius: 28px;',
      '  padding: 12px 20px;',
      '  box-shadow: var(--gc-shadow);',
      '  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);',
      '  font-size: 14px;',
      '  font-weight: 600;',
      '  letter-spacing: -0.01em;',
      '  white-space: nowrap;',
      '  position: relative;',
      '  pointer-events: auto;',
      '}',
      '.gc-launcher:hover {',
      '  transform: translateY(-2px) scale(1.02);',
      '  box-shadow: 0 32px 80px -12px rgba(0,0,0,0.6);',
      '}',
      '.gc-launcher.open {',
      '  border-radius: 20px;',
      '  padding: 12px;',
      '}',
      '.gc-launcher-icon { width: 32px; height: 32px; display:flex; align-items:center; justify-content:center; }',
      '.gc-launcher-label { max-width: 160px; overflow:hidden; text-overflow: ellipsis; }',
      '.gc-panel {',
      '  position: absolute;',
      // If anchored at top, open downward; else open upward.
      (inset.top ? '  top: 70px;' : '  bottom: 70px;'),
      (isRtl ? '  left: 0;' : '  right: 0;'),
      '  width: min(380px, calc(100vw - 24px));',
      '  max-height: min(600px, calc(100dvh - 96px - env(safe-area-inset-bottom)));',
      '  background: var(--gc-bg);',
      '  border: 1px solid rgba(255,255,255,0.08);',
      '  border-radius: var(--gc-radius);',
      '  box-shadow: var(--gc-shadow);',
      '  display: flex;',
      '  flex-direction: column;',
      '  overflow: hidden;',
      '  opacity: 0;',
      '  transform: translateY(20px) scale(0.96);',
      '  pointer-events: none;',
      '  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);',
      '  transform-origin: ' + (isRtl ? 'left' : 'right') + ' ' + (inset.top ? 'top' : 'bottom') + ';',
      '}',
      '.gc-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }',
      '.gc-header { display:flex; align-items:center; gap:12px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }',
      '.gc-header-brand { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }',
      '.gc-header-logo { width:32px; height:32px; border-radius: 8px; background: var(--gc-primary); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; }',
      '.gc-header-logo img { width:100%; height:100%; object-fit: contain; }',
      '.gc-header-name { font-size: 13px; font-weight: 700; color: var(--gc-text); overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }',
      '.gc-header-actions { display:flex; gap:4px; }',
      '.gc-header-btn { width:32px; height:32px; border:none; background: transparent; color: rgba(250,250,250,0.55); border-radius: 8px; cursor:pointer; display:flex; align-items:center; justify-content:center; }',
      '.gc-header-btn:hover { background: rgba(255,255,255,0.06); color: var(--gc-text); }',
      '.gc-intents { display:flex; flex-wrap:wrap; gap:8px; padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }',
      '.gc-intent { appearance:none; border:1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 8px 14px; background: rgba(255,255,255,0.04); color: rgba(250,250,250,0.75); font-size: 12px; font-weight: 600; cursor:pointer; transition: all 0.2s; display:inline-flex; align-items:center; gap:6px; max-inline-size: 100%; }',
      '.gc-intent:hover { background: rgba(255,255,255,0.08); color: var(--gc-text); }',
      '.gc-messages { flex:1; overflow-y: auto; padding: 16px; display:flex; flex-direction: column; gap:12px; min-height:0; }',
      '.gc-msg { display:flex; flex-direction: column; gap: 4px; }',
      '.gc-msg-ai { align-items: flex-start; }',
      '.gc-msg-user { align-items: flex-end; }',
      '.gc-msg-bubble { max-width: 85%; padding: 10px 14px; border-radius: 14px; font-size: 13px; line-height: 1.5; word-break: break-word; }',
      '.gc-msg-ai .gc-msg-bubble { background: rgba(255,255,255,0.06); color: var(--gc-text); }',
      '.gc-msg-user .gc-msg-bubble { background: var(--gc-primary); color: #fff; }',
      '.gc-msg-time { font-size: 10px; color: rgba(250,250,250,0.25); padding: 0 4px; }',
      '.gc-greeting { text-align:center; padding: 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }',
      '.gc-greeting-title { font-size: 15px; font-weight: 700; color: var(--gc-text); margin-bottom: 4px; }',
      '.gc-greeting-desc { font-size: 12px; color: rgba(250,250,250,0.45); line-height: 1.5; }',
      '.gc-input-area { padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }',
      '.gc-input-row { display:grid; grid-template-columns: minmax(0, 1fr) 42px; gap: 8px; align-items: end; }',
      '.gc-input { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px 14px; color: var(--gc-text); font-size: 13px; resize: none; max-height: 120px; outline: none; box-sizing: border-box; text-align: start; }',
      '.gc-input::placeholder { color: rgba(250,250,250,0.3); }',
      '.gc-input:focus { border-color: var(--gc-primary); }',
      '.gc-send-btn { width:42px; height:42px; border:none; background: var(--gc-primary); color:#fff; border-radius: 10px; cursor:pointer; display:flex; align-items:center; justify-content:center; }',
      '.gc-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.gc-powered-by { display:flex; justify-content:center; padding: 6px 12px; font-size: 10px; color: rgba(250,250,250,0.25); border-top: 1px solid rgba(255,255,255,0.04); }',
      '.gc-offline { background: rgba(239,68,68,0.08); border-bottom: 1px solid rgba(239,68,68,0.15); padding: 10px 14px; font-size: 12px; color: rgba(250,250,250,0.7); display:none; }',
      '.gc-offline.active { display:block; }',
      '.gc-offline strong { color: #ef4444; }',
      // Lead capture
      '.gc-lead-capture { padding: 20px 16px; display: none; }',
      '.gc-lead-capture.active { display: block; }',
      '.gc-lead-header { text-align: center; margin-bottom: 16px; }',
      '.gc-lead-title { font-size: 15px; font-weight: 700; color: var(--gc-text); margin-bottom: 4px; }',
      '.gc-lead-subtitle { font-size: 12px; color: rgba(250,250,250,0.45); }',
      '.gc-lead-form { display:flex; flex-direction: column; gap: 12px; }',
      '.gc-lead-field { display:flex; flex-direction: column; gap: 4px; }',
      '.gc-lead-label { font-size: 11px; font-weight: 600; color: rgba(250,250,250,0.5); text-transform: uppercase; letter-spacing: 0.04em; }',
      '.gc-lead-input { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; color: var(--gc-text); font-size: 13px; outline: none; transition: border-color 0.2s; }',
      '.gc-lead-input:focus { border-color: var(--gc-primary); }',
      '.gc-lead-input.error { border-color: #ef4444; }',
      '.gc-lead-error { font-size: 11px; color: #ef4444; min-height: 16px; }',
      '.gc-lead-actions { display:flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }',
      '.gc-lead-skip { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(250,250,250,0.5); padding: 8px 16px; border-radius: 10px; font-size: 12px; cursor:pointer; }',
      '.gc-lead-skip:hover { border-color: rgba(255,255,255,0.2); color: var(--gc-text); }',
      '.gc-consent { display:flex; align-items: flex-start; gap: 8px; font-size: 12px; color: rgba(250,250,250,0.55); line-height: 1.4; }',
      '.gc-consent a { color: rgba(250,250,250,0.7); text-decoration: underline; }',
      '@media (max-width: 480px) {',
      '  :host {',
      (pos.indexOf('left') >= 0 ? '    left: 12px;' : '    right: 12px;'),
      (pos.indexOf('top') >= 0 ? '    top: 12px;' : '    bottom: 12px;'),
      '  }',
      '  .gc-panel { width: calc(100vw - 24px); max-height: 70vh; }',
      '  .gc-launcher-label { display:none; }',
      '}',
    ].join('\n');
  }

  function buildLauncherHTML(cfg, isOpen) {
    var label = (cfg && cfg.branding && cfg.branding.launcherLabel) ? cfg.branding.launcherLabel : 'Support';
    return [
      '<button class="gc-launcher' + (isOpen ? ' open' : '') + '" id="gc-launcher" aria-label="' + escapeHtml(label) + '">',
      '  <div class="gc-launcher-icon">' + iconSvg(ICONS.chat) + '</div>',
      '  <span class="gc-launcher-label">' + escapeHtml(label) + '</span>',
      '</button>'
    ].join('');
  }

  function buildLeadCaptureHTML(cfg) {
    var leads = cfg && cfg.leads ? cfg.leads : { enabled: false };
    var fields = leads.fields && leads.fields.length ? leads.fields : [];
    var title = leads.promptTitle || t('lead_capture_title');
    var subtitle = leads.promptSubtitle || t('lead_capture_subtitle');
    var consentMode = leads.consent && leads.consent.mode ? leads.consent.mode : 'none';
    var privacyUrl = leads.consent && leads.consent.privacy_url ? leads.consent.privacy_url : '';

    var fieldHTML = fields.map(function (field) {
      var type = field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text';
      return '<div class="gc-lead-field">' +
        '<label class="gc-lead-label" for="gc-lead-' + field + '">' + escapeHtml(t('lead_capture_' + field)) + '</label>' +
        '<input class="gc-lead-input" id="gc-lead-' + field + '" type="' + type + '" placeholder="' + escapeHtml(t('lead_capture_' + field)) + '" dir="auto" />' +
        '<div class="gc-lead-error" id="gc-lead-error-' + field + '"></div>' +
        '</div>';
    }).join('');

    var consentHTML = '';
    if (consentMode === 'checkbox') {
      var label = leads.consent && leads.consent.text ? leads.consent.text : t('consent_label');
      if (privacyUrl) {
        label += ' <a href="' + escapeHtml(privacyUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(privacyUrl) + '</a>';
      }
      consentHTML = '<label class="gc-consent">' +
        '<input type="checkbox" id="gc-lead-consent" />' +
        '<span>' + label + '</span>' +
        '</label>';
    }

    var skipBtn = leads.skippable ? '<button class="gc-lead-skip" id="gc-lead-skip" type="button">' + escapeHtml(t('lead_capture_skip')) + '</button>' : '';

    return '<div class="gc-lead-capture" id="gc-lead-capture">' +
      '<div class="gc-lead-header">' +
      '<div class="gc-lead-title">' + escapeHtml(title) + '</div>' +
      '<div class="gc-lead-subtitle">' + escapeHtml(subtitle) + '</div>' +
      '</div>' +
      '<form class="gc-lead-form" id="gc-lead-form">' +
      fieldHTML +
      consentHTML +
      '<div class="gc-lead-actions">' +
      skipBtn +
      '<button class="gc-send-btn" id="gc-lead-submit" type="submit">' + escapeHtml(t('lead_capture_submit')) + '</button>' +
      '</div>' +
      '</form>' +
      '</div>';
  }

  function buildPanelHTML(cfg) {
    var greeting = t('greeting_default');
    var brandName = (cfg && cfg.branding && cfg.branding.brandName) ? cfg.branding.brandName : 'Support';
    var intents = (cfg && cfg.widget && cfg.widget.showIntents !== false) ? (cfg.intents || []) : [];
    var intentsHTML = '';

    if (intents.length > 0) {
      intentsHTML = '<div class="gc-intents">' + intents.map(function (intent) {
        return '<button class="gc-intent" data-intent-id="' + escapeHtml(intent.id || '') + '" data-intent-behavior="' + escapeHtml(intent.behavior || 'send_message') + '" data-intent-label="' + escapeHtml(intent.label || '') + '" data-intent-message="' + escapeHtml(intent.message_text || '') + '" data-intent-url="' + escapeHtml(intent.external_url || '') + '">' +
          '<span>' + escapeHtml(intent.label || '') + '</span>' +
          '</button>';
      }).join('') + '</div>';
    }

    var poweredBy = '';
    if (cfg && cfg.branding && cfg.branding.attribution && cfg.branding.attribution.showPoweredBy) {
      poweredBy = '<div class="gc-powered-by"><span>' + escapeHtml(t('powered_by')) + '</span></div>';
    }

    return [
      '<div class="gc-panel" id="gc-panel" role="dialog" aria-modal="false" aria-label="' + escapeHtml(brandName) + '" dir="' + (currentLang() === 'ar' ? 'rtl' : 'ltr') + '">',
      '<div class="gc-offline" id="gc-offline">',
      '<strong>' + escapeHtml(t('offline_title')) + '</strong><br/>' + escapeHtml(t('offline_desc')) +
      '</div>',
      '<div class="gc-header">',
      '  <div class="gc-header-brand">',
      '    <div class="gc-header-logo">',
      (cfg.branding.logoUrl ? '<img src="' + escapeHtml(cfg.branding.logoUrl) + '" alt="logo"/>' : iconSvg(ICONS.chat)),
      '    </div>',
      '    <div class="gc-header-name">' + escapeHtml(brandName) + '</div>',
      '  </div>',
      '  <div class="gc-header-actions">',
      '    <button class="gc-header-btn" id="gc-minimize-btn" title="' + escapeHtml(t('minimize')) + '" aria-label="' + escapeHtml(t('minimize')) + '">' + iconSvg(ICONS.expand_less) + '</button>',
      '    <button class="gc-header-btn" id="gc-close-btn" title="' + escapeHtml(t('close')) + '" aria-label="' + escapeHtml(t('close')) + '">' + iconSvg(ICONS.close) + '</button>',
      '  </div>',
      '</div>',
      intentsHTML,
      '<div class="gc-messages" id="gc-messages"></div>',
      '<div class="gc-greeting" id="gc-greeting">',
      '  <div class="gc-greeting-title">' + escapeHtml(brandName) + '</div>',
      '  <div class="gc-greeting-desc">' + escapeHtml(greeting) + '</div>',
      '</div>',
      buildLeadCaptureHTML(cfg),
      '<div class="gc-input-area" id="gc-input-area">',
      '  <div class="gc-input-row" dir="' + (currentLang() === 'ar' ? 'rtl' : 'ltr') + '">',
      '    <textarea class="gc-input" id="gc-input" rows="1" placeholder="' + escapeHtml(t('placeholder')) + '" dir="auto" aria-label="' + escapeHtml(t('placeholder')) + '"></textarea>',
      '    <button class="gc-send-btn" id="gc-send-btn" disabled aria-label="' + escapeHtml(t('send')) + '">' + iconSvg(ICONS.send) + '</button>',
      '  </div>',
      '</div>',
      poweredBy,
      '</div>'
    ].join('');
  }

  function buildMessageHTML(msg) {
    var isUser = msg.role === 'user';
    var time = formatTime(msg.created_at || new Date());
    return [
      '<div class="gc-msg gc-msg-' + (isUser ? 'user' : 'ai') + '">',
      '  <div class="gc-msg-bubble">' + escapeHtml(msg.content).replace(/\n/g, '<br/>') + '</div>',
      '  <div class="gc-msg-time">' + escapeHtml(time) + '</div>',
      '</div>'
    ].join('');
  }

  function mountUI() {
    if (state.host) return;

    var cfg = state.effective;

    // Host
    var host = document.createElement('div');
    host.id = 'gc-widget-host';
    host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;inset:0;';
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'closed' });

    var style = document.createElement('style');
    style.textContent = buildStyles(cfg);
    shadow.appendChild(style);

    var container = document.createElement('div');
    container.id = 'gc-container';
    container.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;inset:0;display:flex;align-items:flex-end;justify-content:flex-end;';
    shadow.appendChild(container);

    state.host = host;
    state.shadow = shadow;
    state.container = container;

    // Render
    container.innerHTML = buildLauncherHTML(cfg, false) + buildPanelHTML(cfg);

    // Offline banner
    var offlineEl = shadow.getElementById('gc-offline');
    if (offlineEl) {
      if (state.offlineMode) offlineEl.classList.add('active');
      else offlineEl.classList.remove('active');
    }

    wireEvents();

    if (cfg && cfg.widget && cfg.widget.defaultOpen) {
      api.open();
    }
  }

  function unmountUI() {
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
    if (state.host) {
      try { state.host.remove(); } catch (e) {}
    }
    state.host = null;
    state.shadow = null;
    state.container = null;
  }

  function wireEvents() {
    var container = state.container;
    if (!container || !state.shadow) return;

    container.addEventListener('click', function (e) {
      var target = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!target) return;

      var id = target.id;
      if (id === 'gc-launcher') {
        api.toggle();
        return;
      }
      if (id === 'gc-close-btn' || id === 'gc-minimize-btn') {
        api.close();
        return;
      }
      if (id === 'gc-send-btn') {
        handleSend();
        return;
      }
      if (id === 'gc-lead-skip') {
        state.leadCaptured = true;
        hideLeadCapture();
        track('lead_capture_skipped', {});
        return;
      }
      if (target.classList.contains('gc-intent')) {
        handleIntent(target);
        return;
      }
    });

    var ta = state.shadow.getElementById('gc-input');
    if (ta) {
      ta.addEventListener('input', function () {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        var sendBtn = state.shadow.getElementById('gc-send-btn');
        if (sendBtn) sendBtn.disabled = !ta.value.trim();
      });
      ta.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter' && !evt.shiftKey) {
          evt.preventDefault();
          handleSend();
        }
      });
    }

    var leadForm = state.shadow.getElementById('gc-lead-form');
    if (leadForm) {
      leadForm.addEventListener('submit', function (evt) {
        evt.preventDefault();
        handleLeadSubmit();
      });
    }

    document.addEventListener('keydown', function (evt) {
      if (evt.key === 'Escape') {
        api.close();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Lead capture
  // ─────────────────────────────────────────────────────────────

  function shouldShowLeadCapture(trigger) {
    var cfg = state.effective;
    if (!cfg || !cfg.leads || cfg.leads.enabled !== true) return false;
    if (state.leadCaptured) return false;

    var timing = cfg.leads.captureTiming || 'off';
    if (timing === 'off') return false;
    if (timing === 'before_chat_required' && trigger === 'init') return true;
    if (timing === 'before_chat_skippable' && trigger === 'init') return true;
    if (timing === 'after_intent' && trigger === 'intent') return true;
    if (timing === 'after_2_messages' && trigger === 'message' && state.messageCount >= 2) return true;
    if (timing === 'after_3_messages' && trigger === 'message' && state.messageCount >= 3) return true;
    return false;
  }

  function showLeadCapture() {
    state.leadCaptureActive = true;
    var form = state.shadow.getElementById('gc-lead-capture');
    var inputArea = state.shadow.getElementById('gc-input-area');
    var greeting = state.shadow.getElementById('gc-greeting');
    if (form) form.classList.add('active');
    if (inputArea) inputArea.style.display = 'none';
    if (greeting) greeting.style.display = 'none';
  }

  function hideLeadCapture() {
    state.leadCaptureActive = false;
    var form = state.shadow.getElementById('gc-lead-capture');
    var inputArea = state.shadow.getElementById('gc-input-area');
    if (form) form.classList.remove('active');
    if (inputArea) inputArea.style.display = '';
  }

  function validateLeadField(field, value) {
    if (field === 'name' && !value) return t('lead_capture_name_error');
    if (field === 'email') {
      if (!value) return t('lead_capture_email_error');
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return t('lead_capture_email_error');
    }
    if (field === 'phone' && value) {
      var phoneRegex = /^[+]?[\d\s()-]{7,20}$/;
      if (!phoneRegex.test(value)) return t('lead_capture_phone_error');
    }
    if (field === 'company' && !value) return t('lead_capture_company_error');
    return null;
  }

  function handleLeadSubmit() {
    if (state.offlineMode || !tokenValid()) {
      addAssistantMessage(t('error'));
      return;
    }

    var cfg = state.effective;
    var fields = cfg.leads.fields || [];
    var required = cfg.leads.requiredFields || [];
    var leadData = {};
    var hasError = false;

    fields.forEach(function (field) {
      var input = state.shadow.getElementById('gc-lead-' + field);
      var errorEl = state.shadow.getElementById('gc-lead-error-' + field);
      if (input) input.classList.remove('error');
      if (errorEl) errorEl.textContent = '';
    });

    fields.forEach(function (field) {
      var input = state.shadow.getElementById('gc-lead-' + field);
      if (!input) return;
      var value = (input.value || '').trim();
      leadData[field] = value;
      var err = validateLeadField(field, value);
      if (!err && required.indexOf(field) >= 0 && !value) {
        err = 'required';
      }
      if (err) {
        hasError = true;
        input.classList.add('error');
        var errorEl = state.shadow.getElementById('gc-lead-error-' + field);
        if (errorEl) errorEl.textContent = err === 'required' ? t('error') : err;
      }
    });

    var consentMode = cfg.leads.consent && cfg.leads.consent.mode ? cfg.leads.consent.mode : 'none';
    var consentPayload = null;
    if (consentMode === 'checkbox') {
      var cb = state.shadow.getElementById('gc-lead-consent');
      if (!cb || !cb.checked) {
        hasError = true;
        addAssistantMessage(t('error'));
      } else {
        consentPayload = { accepted: true, text: cfg.leads.consent.text || '' };
      }
    }

    if (hasError) return;

    state.leadCaptured = true;
    hideLeadCapture();

    callWidget('widget-lead-submit', {
      conversation_id: state.conversationId || null,
      intent_id: state.lastIntentId || null,
      lead: {
        name: leadData.name || null,
        email: leadData.email || null,
        phone: leadData.phone || null,
        company: leadData.company || null
      },
      consent: consentPayload
    }, { timeoutMs: 6000 }).then(function (res) {
      if (!res.ok) {
        raiseError({ code: (res.data && res.data.error) || 'lead_submit_failed', message: 'Lead submit failed.' });
      }
      track('lead_captured', { fields: fields });
    }).catch(function (e) {
      if (state.init && state.init.debug) errLog('Lead submit error', e);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Conversation + messaging
  // ─────────────────────────────────────────────────────────────

  function ensureConversation() {
    if (state.offlineMode) return Promise.reject(new Error('offline'));
    if (!tokenValid()) return Promise.reject(new Error('unauthorized'));

    if (state.conversationId) return Promise.resolve(state.conversationId);

    var init = state.init;
    var cached = getConversationId(init.embedKey);
    if (cached) state.conversationId = cached;

    return callWidget('widget-session-start', {
      conversation_id: cached || null,
      visitor: {
        anonymous_id: getVisitorId(),
        email: init.user && init.user.email ? init.user.email : null,
        name: init.user && init.user.name ? init.user.name : null
      },
      page: {
        url: init.context.pageUrl || window.location.href,
        title: document.title || ''
      }
    }, { timeoutMs: 6000 }).then(function (res) {
      if (!res.ok || !res.data || !res.data.ok) {
        throw new Error((res.data && res.data.error) || 'session_start_failed');
      }
      state.conversationId = res.data.conversation_id;
      setConversationId(init.embedKey, state.conversationId);
      track('conversation_start', { conversation_id: state.conversationId });
      return state.conversationId;
    });
  }

  function addMessageToList(msg) {
    var list = state.shadow && state.shadow.getElementById('gc-messages');
    if (!list) return;
    var div = document.createElement('div');
    div.innerHTML = buildMessageHTML(msg);
    if (div.firstElementChild) list.appendChild(div.firstElementChild);
    list.scrollTop = list.scrollHeight;
  }

  function hideGreeting() {
    var g = state.shadow && state.shadow.getElementById('gc-greeting');
    if (g) g.style.display = 'none';
  }

  function addAssistantMessage(content) {
    addMessageToList({ role: 'assistant', content: content, created_at: new Date().toISOString() });
  }

  function startPolling() {
    if (state.offlineMode) return;
    if (state.pendingPoll) return;
    if (!state.conversationId) return;

    state.pendingPoll = true;

    var after = state.lastSeenCreatedAt;
    callWidget('widget-message-poll', {
      conversation_id: state.conversationId,
      after: after || null
    }, { timeoutMs: 6000 }).then(function (res) {
      state.pendingPoll = false;
      if (!res.ok || !res.data || !res.data.ok) {
        schedulePoll(true);
        return;
      }

      var msgs = res.data.messages || [];
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];
        if (!m || !m.created_at) continue;
        state.lastSeenCreatedAt = m.created_at;
        if (m.role === 'assistant') {
          addMessageToList(m);
        }
      }

      schedulePoll(false);
    }).catch(function () {
      state.pendingPoll = false;
      schedulePoll(true);
    });
  }

  function schedulePoll(failed) {
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
    var next = failed ? Math.min(state.pollMaxMs, state.pollIntervalMs * 2) : state.pollIntervalMs;
    state.pollIntervalMs = next;
    state.pollTimer = setTimeout(startPolling, next);
  }

  function handleSend() {
    var ta = state.shadow && state.shadow.getElementById('gc-input');
    if (!ta || !ta.value.trim()) return;

    var text = ta.value.trim();
    ta.value = '';
    ta.style.height = 'auto';

    var sendBtn = state.shadow.getElementById('gc-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    hideGreeting();
    addMessageToList({ role: 'user', content: text, created_at: new Date().toISOString() });
    state.messageCount++;

    if (shouldShowLeadCapture('message')) {
      showLeadCapture();
      return;
    }

    ensureConversation().then(function () {
      return callWidget('widget-message-send', {
        conversation_id: state.conversationId,
        content: text,
        content_type: 'text',
        intent_id: null
      }, { timeoutMs: 6000 });
    }).then(function (res) {
      if (!res.ok) {
        addAssistantMessage(t('error'));
        raiseError({ code: (res.data && res.data.error) || 'message_send_failed', message: 'Send failed.' });
        return;
      }

      track('message_sent', { content_type: 'text' });
      startPolling();
    }).catch(function (e) {
      if (state.init && state.init.debug) errLog('Send failed', e);
      addAssistantMessage(t('error'));
    });
  }

  function handleIntent(btn) {
    var behavior = btn.getAttribute('data-intent-behavior') || 'send_message';
    var intentId = btn.getAttribute('data-intent-id') || null;
    var label = btn.getAttribute('data-intent-label') || '';
    var msgText = btn.getAttribute('data-intent-message') || '';
    var url = btn.getAttribute('data-intent-url') || '';

    state.lastIntentId = intentId;

    if (shouldShowLeadCapture('intent')) {
      showLeadCapture();
      return;
    }

    track('intent_click', { intent_id: intentId, label: label, behavior: behavior });

    if (behavior === 'open_url' && url) {
      window.open(url, '_blank', 'noopener');
      return;
    }

    if (behavior === 'handoff') {
      hideGreeting();
      addAssistantMessage('We will connect you with our team.');
      sendEvent('escalation_trigger', { intent_id: intentId, label: label });
      return;
    }

    // send_message
    var content = msgText || label;
    if (!content) return;
    hideGreeting();
    addMessageToList({ role: 'user', content: content, created_at: new Date().toISOString() });
    state.messageCount++;

    ensureConversation().then(function () {
      return callWidget('widget-message-send', {
        conversation_id: state.conversationId,
        content: content,
        content_type: 'intent',
        intent_id: intentId
      }, { timeoutMs: 6000 });
    }).then(function (res) {
      if (!res.ok) {
        addAssistantMessage(t('error'));
        raiseError({ code: (res.data && res.data.error) || 'message_send_failed', message: 'Send failed.' });
        return;
      }
      startPolling();
    }).catch(function (e) {
      if (state.init && state.init.debug) errLog('Intent send failed', e);
      addAssistantMessage(t('error'));
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Public API + loader attachment
  // ─────────────────────────────────────────────────────────────

  function raiseError(error) {
    var init = state.init;
    if (init && typeof init.onError === 'function') {
      try { init.onError(error); } catch (e) {}
    }
  }

  function track(eventName, payload) {
    var init = state.init;
    if (init && typeof init.onEvent === 'function') {
      try { init.onEvent({ name: eventName, payload: payload || {} }); } catch (e) {}
    }
    sendEvent(eventName, payload || {});
  }

  function sendEvent(eventName, payload) {
    if (!tokenValid() || state.offlineMode) return;
    callWidget('widget-event', { event: eventName, payload: payload || {} }, { timeoutMs: 3000, noRebootstrap: false }).catch(function () {});
  }

  function normalizeInitOptions(input) {
    var cfg = input && typeof input === 'object' ? input : {};
    var embedKey = cfg.embedKey || cfg.embed_key;

    // Only allow visitor identity + context + callbacks from init.
    var init = {
      embedKey: embedKey || null,
      locale: cfg.locale || 'auto',
      debug: cfg.debug === true,
      user: {
        id: cfg.user && cfg.user.id ? String(cfg.user.id) : null,
        email: cfg.user && cfg.user.email ? String(cfg.user.email) : (cfg.userEmail ? String(cfg.userEmail) : null),
        name: cfg.user && cfg.user.name ? String(cfg.user.name) : (cfg.userName ? String(cfg.userName) : null),
        phone: cfg.user && cfg.user.phone ? String(cfg.user.phone) : null,
        company: cfg.user && cfg.user.company ? String(cfg.user.company) : null
      },
      context: {
        pageUrl: cfg.context && cfg.context.pageUrl ? String(cfg.context.pageUrl) : window.location.href,
        referrer: cfg.context && cfg.context.referrer ? String(cfg.context.referrer) : (document.referrer || ''),
        custom: (cfg.context && cfg.context.custom && typeof cfg.context.custom === 'object') ? cfg.context.custom : {}
      },
      onReady: typeof cfg.onReady === 'function' ? cfg.onReady : null,
      onEvent: typeof cfg.onEvent === 'function' ? cfg.onEvent : null,
      onError: typeof cfg.onError === 'function' ? cfg.onError : null
    };

    return init;
  }

  function initRuntime(options) {
    if (state.phase !== 'idle') {
      warn('Already initialized.');
      return api;
    }

    state.phase = 'loading';
    state.init = normalizeInitOptions(options);

    if (!state.init.embedKey) {
      raiseError({ code: 'embed_key_required', message: 'embedKey is required.' });
      state.phase = 'idle';
      return api;
    }

    return bootstrapOnce({ force: true }).then(function (ok) {
      if (!ok || !state.effective) {
        state.phase = 'error';
        return api;
      }

      mountUI();
      state.phase = 'ready';

      if (shouldShowLeadCapture('init')) {
        showLeadCapture();
      }

      if (state.init.onReady) {
        try { state.init.onReady(state.effective); } catch (e) {}
      }

      return api;
    });
  }

  var api = {
    init: function (options) {
      // Loader expects sync return. We still start async work.
      initRuntime(options);
      return api;
    },
    open: function () {
      if (!state.shadow || !state.container) return;
      var panel = state.container.querySelector('.gc-panel');
      var launcher = state.container.querySelector('.gc-launcher');
      if (panel) panel.classList.add('open');
      if (launcher) launcher.classList.add('open');
      state.phase = 'open';
      track('widget_open', { page_url: window.location.href });

      var ta = state.shadow.getElementById('gc-input');
      if (ta) setTimeout(function () { ta.focus(); }, 50);
    },
    close: function () {
      if (!state.shadow || !state.container) return;
      var panel = state.container.querySelector('.gc-panel');
      var launcher = state.container.querySelector('.gc-launcher');
      if (panel) panel.classList.remove('open');
      if (launcher) launcher.classList.remove('open');
      track('widget_close', {});
      if (state.phase !== 'ready') state.phase = 'ready';
    },
    toggle: function () {
      if (state.phase === 'open') api.close();
      else api.open();
    },
    destroy: function () {
      unmountUI();
      state.phase = 'idle';
      state.init = null;
      state.effective = null;
      state.token = null;
      state.tokenExpiresAt = 0;
      state.bootstrapTried = false;
      state.offlineMode = false;
      state.conversationId = null;
      state.lastSeenCreatedAt = null;
    },
    updateContext: function (partial) {
      partial = partial && typeof partial === 'object' ? partial : {};
      if (!state.init) return;
      if (partial.pageUrl) state.init.context.pageUrl = String(partial.pageUrl);
      if (partial.referrer) state.init.context.referrer = String(partial.referrer);
      if (partial.custom && typeof partial.custom === 'object') {
        for (var k in partial.custom) state.init.context.custom[k] = partial.custom[k];
      }
    },
    identify: function (user) {
      user = user && typeof user === 'object' ? user : {};
      if (!state.init) return;
      if (user.id != null) state.init.user.id = String(user.id);
      if (user.email != null) state.init.user.email = String(user.email);
      if (user.name != null) state.init.user.name = String(user.name);
      if (user.phone != null) state.init.user.phone = String(user.phone);
      if (user.company != null) state.init.user.company = String(user.company);
    },
    track: function (eventName, payload) {
      track(String(eventName || ''), payload || {});
    },
    getVersion: function () { return VERSION; },
    push: function (item) {
      if (typeof item === 'function') {
        try { item(api); } catch (e) {}
        return;
      }
      if (item && typeof item === 'object') {
        api.init(item);
      }
    },

    // Back-compat aliases
    updateConfig: function (updates) {
      // Only allow context-like updates (do not allow appearance overrides).
      api.updateContext(updates || {});
    },
    setContext: function (ctx) {
      api.updateContext(ctx || {});
    },
    identifyUser: function (email, name) {
      api.identify({ email: email || null, name: name || null });
    },
    trackEvent: function (eventName, payload) {
      api.track(eventName, payload);
    }
  };

  // Attach to loader if present.
  var existing = window.GrindctrlSupport;
  if (existing && typeof existing.__attachRuntime === 'function') {
    existing.__attachRuntime(api);
  } else {
    window.GrindctrlSupport = api;
  }

})(window, document);
