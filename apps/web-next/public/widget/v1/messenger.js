/**
 * GRINDCTRL Support Messenger — storefront loader.
 *
 * Design contract:
 * - Guest, never resident: one tiny script tag, one small launcher button in
 *   its own shadow root, and NO messenger surface until the shopper asks.
 *   The messenger itself is an iframe on grindctrl.cloud loaded on first
 *   open (perfect CSS/JS isolation from the merchant theme).
 * - Fails quiet: any error here must never affect the store page.
 * - Public API: window.GRINDCTRL_MESSENGER.open/close/toggle/identify/logout
 *   callable before init (queued), after init, repeatedly, safely.
 */
(function () {
  'use strict';

  var SCRIPT = document.currentScript;
  var SHOP = SCRIPT && SCRIPT.getAttribute('data-shop');
  var KEY = (SCRIPT && SCRIPT.getAttribute('data-key')) || '';
  var LOCALE_HINT = (SCRIPT && SCRIPT.getAttribute('data-locale')) || '';
  var CUSTOMER = {
    id: (SCRIPT && SCRIPT.getAttribute('data-customer-id')) || '',
    email: (SCRIPT && SCRIPT.getAttribute('data-customer-email')) || '',
    name: (SCRIPT && SCRIPT.getAttribute('data-customer-name')) || ''
  };
  /* Either identifier is a valid install. The Shopify app-embed block only
     knows the shop's permanent domain (zero merchant setup, nothing to
     paste), so requiring data-key here would make that entire install path
     dead on arrival. */
  if (!KEY && !SHOP) return;

  var GLOBAL = 'GRINDCTRL_MESSENGER';
  var ORIGIN = window.location.origin;
  var APP_ORIGIN = (SCRIPT && SCRIPT.getAttribute('data-app-origin')) || new URL(SCRIPT.src).origin;
  /* Storage namespace has to be stable BEFORE the config response arrives,
     so it keys off whichever identifier the page gave us. */
  var NS = KEY || SHOP;
  var LS = {
    config: 'gc_msgr_' + NS + '_cfg',
    anon: 'gc_msgr_' + NS + '_anon',
    conv: 'gc_msgr_' + NS + '_conv',
    token: 'gc_msgr_token_' + NS,
    greeted: 'gc_msgr_' + NS + '_greeted',
    proactiveCount: 'gc_msgr_' + NS + '_proactive_n'
  };
  var CONFIG_TTL_MS = 5 * 60 * 1000;

  var state = {
    config: null,
    booted: false,
    open: false,
    iframe: null,
    host: null,
    launcher: null,
    teaser: null,
    locale: detectLocale(),
    identified: false,
    loggedOut: false
  };

  function lsGet(name) { try { return window.localStorage.getItem(name); } catch (e) { return null; } }
  function lsSet(name, value) { try { window.localStorage.setItem(name, value); } catch (e) {} }
  function lsRemove(name) { try { window.localStorage.removeItem(name); } catch (e) {} }
  function uuid() {
    try { return crypto.randomUUID().replace(/-/g, ''); } catch (e) {
      return ('xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx').replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    }
  }
  function ensureAnonId() {
    var existing = lsGet(LS.anon);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    var fresh = uuid();
    lsSet(LS.anon, fresh);
    return fresh;
  }

  /* ── Targeting ── */
  function pageExcluded(cfg) {
    if (!cfg || !cfg.behaviour) return false;
    if (cfg.behaviour.targetingMode !== 'custom') return false;
    var href = String(window.location.href).toLowerCase();
    var patterns = cfg.behaviour.excludePatterns || [];
    // Custom mode: show everywhere EXCEPT matched patterns.
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i] && href.indexOf(patterns[i]) !== -1) return true;
    }
    return false;
  }

  /* ── Config fetch with last-known-good fallback ── */
  function cachedConfig() {
    try {
      var raw = lsGet(LS.config);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.fetchedAt && Date.now() - parsed.fetchedAt < CONFIG_TTL_MS ? parsed.data : parsed.data || null;
    } catch (e) { return null; }
  }

  function fetchConfig(done) {
    if (!KEY && !SHOP) return;
    var url = APP_ORIGIN + '/api/messenger/config?' +
      (KEY ? 'key=' + encodeURIComponent(KEY) : 'shop=' + encodeURIComponent(SHOP)) +
      '&origin=' + encodeURIComponent(ORIGIN);
    fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }).then(function (data) {
      lsSet(LS.config, JSON.stringify({ fetchedAt: Date.now(), data: data }));
      done(data);
    }).catch(function () {
      var fallback = cachedConfig();
      track('config_fetch_failed', {});
      done(fallback);
    });
  }

  /* The merchant's launcher size, honoured. The dashboard has always let it
     be set, the preview has always reflected it, and the loader simply never
     read appearance.launcherSizePx — the button was hardcoded to 48px tall
     (56 when icon-only) in the stylesheet above. So the slider moved, the
     preview changed, the merchant published, and their store looked exactly
     the same. Clamped to the same 44-72 the server clamps to, so a hand-
     edited config cannot produce a launcher that covers the page. */
  function launcherSize() {
    var px = state.config && state.config.appearance && state.config.appearance.launcherSizePx;
    px = Number(px);
    if (!isFinite(px)) return 56;
    return Math.min(Math.max(Math.round(px), 44), 72);
  }

  function detectLocale() {
    if (LOCALE_HINT === 'ar' || LOCALE_HINT === 'en') return LOCALE_HINT;
    try { return (navigator.language || 'en').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en'; } catch (e) { return 'en'; }
  }

  /* The merchant's choice outranks the browser's. state.locale is resolved at
     load, before any config exists, so it can only be the browser guess; this
     re-resolves once the config has arrived. A store that only ever serves
     Arabic had no way to say so — the widget followed whatever language the
     shopper's browser happened to be set to. An explicit data-locale on the
     script tag still wins over both, because that is a deliberate per-page
     override by whoever installed it. */
  function resolveLocale(config) {
    if (LOCALE_HINT === 'ar' || LOCALE_HINT === 'en') return LOCALE_HINT;
    var mode = config && config.appearance && config.appearance.languageMode;
    if (mode === 'ar' || mode === 'en') return mode;
    return detectLocale();
  }

  function pick(localized) {
    if (!localized) return '';
    return state.locale === 'ar' ? (localized.ar || localized.en) : (localized.en || localized.ar);
  }

  function track(name, payload) {
    try {
      fetch(APP_ORIGIN + '/api/messenger/event', {
        method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ key: state.config ? state.config.key : KEY, shop: SHOP || undefined, origin: ORIGIN, name: name,
          conversationId: lsGet(LS.conv) || undefined, payload: payload || {} })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ── Launcher (shadow-isolated) ── */
  var CSS_TEXT =
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","IBM Plex Sans Arabic",sans-serif}' +
    '.btn{position:fixed;z-index:2147482000;display:flex;align-items:center;gap:8px;height:48px;padding:0 18px;border:none;border-radius:999px;background:#2a2826;color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.22);transition:transform .18s ease,opacity .18s ease;-webkit-tap-highlight-color:transparent}' +
    '.btn:hover{transform:translateY(-2px)}' +
    '.btn:focus-visible{outline:2px solid currentColor;outline-offset:3px}' +
    '.btn.icon-only{width:56px;height:56px;padding:0;justify-content:center}' +
    '.btn svg{display:block}' +
    /* :host(), not a bare descendant selector. `.pos-br` lives on the HOST
       element, outside this shadow root, so `.pos-br .btn` could never match
       from in here — the button kept right/left:auto, sat at its static
       position inside a zero-width host, and hung ~36px off the edge of the
       screen on every store. Same bug, same fix, for the teaser. */
    ':host(.pos-br) .btn{right:20px}:host(.pos-bl) .btn{left:20px}' +
    '.bottom{bottom:20px}' +
    '@media (prefers-reduced-motion:reduce){.btn{transition:none}}' +
    '.teaser{position:fixed;z-index:2147481990;max-width:min(280px,calc(100vw - 96px));background:#fff;color:#1c1917;border:1px solid rgba(0,0,0,.08);border-radius:14px 14px 4px 14px;padding:10px 14px;font-size:13px;line-height:1.45;box-shadow:0 8px 28px rgba(0,0,0,.16);cursor:pointer;animation:pop .25s ease}' +
    '.teaser[dir="rtl"]{border-radius:14px 14px 14px 4px}' +
    ''  /* teaser offset is set inline from launcherSize() — see showTeaser */ +
    '@keyframes pop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}';

  function iconSvg(kind, customUrl) {
    if (customUrl) {
      return '<img src="' + customUrl.replace(/"/g, '%22') + '" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover" referrerpolicy="no-referrer"/>';
    }
    var stroke = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
    if (kind === 'message') {
      return '<svg width="24" height="24" viewBox="0 0 24 24" ' + stroke + '><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>';
    }
    if (kind === 'help') {
      return '<svg width="24" height="24" viewBox="0 0 24 24" ' + stroke + '><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/></svg>';
    }
    return '<svg width="24" height="24" viewBox="0 0 24 24" ' + stroke + '><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  }

  function buildLauncher() {
    var hostEl = document.createElement('div');
    hostEl.className = 'pos-' + (state.config.appearance.position === 'bottom-left' ? 'bl' : 'br');
    hostEl.style.cssText = 'position:fixed;inset:auto;bottom:20px;z-index:2147482000;' +
      (state.config.appearance.position === 'bottom-left' ? 'left:' : 'right:') + offset('x') +
      ';--gc-accent:' + safeColor(state.config.appearance.accentColor);
    var root = hostEl.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS_TEXT;
    root.appendChild(style);

    var label = pick(state.config.appearance.launcherLabel);
    var iconOnly = !label;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn bottom icon-only';
    btn.setAttribute('aria-label', label || (state.locale === 'ar' ? 'الدعم' : 'Support'));
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = iconSvg(state.config.appearance.launcherIcon, state.config.appearance.launcherCustomIconUrl);
    var size = launcherSize();
    btn.style.height = size + 'px';
    // Icon-only is a circle, so width tracks height; a labelled pill keeps its
    // intrinsic width and only grows taller.
    if (iconOnly) btn.style.width = size + 'px';
    btn.addEventListener('click', function () { toggle(); });
    root.appendChild(btn);

    state.host = hostEl;
    state.launcherBtn = btn;
    state.teaserHost = root;
    document.body.appendChild(hostEl);
    applyAccent(btn);
  }

  function offset(axis) {
    // Reserved hook for advanced placement; defaults keep clear of edges.
    void axis;
    return '20px;';
  }
  function safeColor(c) {
    return /^#[0-9a-fA-F]{6}$/.test(String(c)) ? String(c) : '#2a2826';
  }
  function applyAccent(btn) {
    btn.style.background = safeColor(state.config.appearance.accentColor);
  }

  function showTeaser(text, kind) {
    if (!state.teaserHost || state.open) return;
    if (kind === 'greeting' && lsGet(LS.greeted)) return;
    if (kind === 'proactive') {
      var n = Number(lsGet(LS.proactiveCount) || 0);
      if (n >= (state.config.behaviour.proactiveCapPerVisitor || 1)) return;
      lsSet(LS.proactiveCount, String(n + 1));
    }
    removeTeaser();
    var el = document.createElement('div');
    el.className = 'teaser bottom';
    el.setAttribute('dir', state.locale === 'ar' ? 'rtl' : 'ltr');
    el.setAttribute('role', 'status');
    el.textContent = text;
    /* Clears the launcher by its actual width. This used to be a flat 84px in
       the stylesheet, which only lined up with the old fixed 56px button. */
    var clear = launcherSize() + 28;
    if (state.config.appearance.position === 'bottom-left') el.style.left = clear + 'px';
    else el.style.right = clear + 'px';
    el.addEventListener('click', function () { markTeaserSeen(kind); open(); });
    state.teaserHost.appendChild(el);
    state.teaser = el;
    state.teaserKind = kind;
    if (kind) track(kind === 'proactive' ? 'proactive_shown' : 'greeting_shown', {});
    setTimeout(removeTeaser, 9000);
  }
  function markTeaserSeen(kind) {
    if (kind === 'greeting') lsSet(LS.greeted, '1');
    if (kind === 'proactive') track('proactive_dismissed', {});
  }
  function removeTeaser() {
    if (state.teaser && state.teaser.parentNode) state.teaser.parentNode.removeChild(state.teaser);
    state.teaser = null;
  }

  /* ── Messenger iframe ── */
  /* Width decides this, not min(width,height). Using the smaller edge meant a
     wide-but-SHORT viewport — a Shopify theme-editor preview, a short desktop
     window, any landscape phone — was treated as a small screen and got the
     full-bleed layout, so the panel covered the whole page instead of docking
     to the corner. Height is handled by the panel's own max-height instead. */
  function isSmallScreen() { return window.innerWidth <= 560; }

  function buildIframe() {
    var effectiveKey = (state.config && state.config.key) || KEY;
    if (!effectiveKey) return;
    var params = '?key=' + encodeURIComponent(effectiveKey) +
      '&locale=' + encodeURIComponent(LOCALE_HINT || state.locale) +
      '&origin=' + encodeURIComponent(ORIGIN);
    var frame = document.createElement('iframe');
    frame.src = APP_ORIGIN + '/embed/messenger' + params;
    frame.title = state.locale === 'ar' ? 'محادثة الدعم' : 'Support chat';
    frame.allow = 'clipboard-write';
    // sizeIframe writes the complete style, including the closed-state visuals.
    sizeIframe(frame);
    document.body.appendChild(frame);
    state.iframe = frame;
    setTimeout(function () { state.booted = true; }, 50);
  }

  /* Writes the COMPLETE style every time instead of appending. The old
     `cssText +=` could only ever run once safely: re-sizing appended a second
     set of declarations, and the full-bleed branch's `inset:0` survived into
     the docked branch (which sets only bottom/right), leaving the panel
     stretched across the page. Re-sizing has to be idempotent for the resize
     listener below to be safe. */
  var FRAME_BASE = 'position:fixed;z-index:2147482001;border:none;background:transparent;' +
    'transition:opacity .18s ease,transform .18s ease;color-scheme:normal;';

  function sizeIframe(frame) {
    var small = isSmallScreen();
    var css = FRAME_BASE;

    if (small) {
      css += 'inset:0;width:100vw;height:100dvh;max-height:100dvh;border-radius:0;box-shadow:none;';
    } else {
      var posLeft = state.config && state.config.appearance.position === 'bottom-left';
      // top/left are reset explicitly so a previous full-bleed pass cannot
      // leave the panel anchored to the top-left corner as well.
      // 88px was 56 + 20 + 12: the old fixed launcher, its gutter, and a gap.
      // With a resizable launcher those constants have to come from it, or a
      // 72px button sits under the panel it opened.
      css += 'top:auto;bottom:' + (launcherSize() + 32) + 'px;' +
        (posLeft ? 'left:20px;right:auto;' : 'right:20px;left:auto;') +
        'width:min(384px,calc(100vw - 40px));height:min(600px,calc(100dvh - 120px));' +
        'border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.24);';
    }

    // Rewriting cssText drops the open/closed visuals, so restate them.
    css += state.open
      ? 'opacity:1;pointer-events:auto;transform:none;'
      : 'opacity:0;pointer-events:none;' + (small ? '' : 'transform:translateY(6px);');

    frame.style.cssText = css;
  }

  /* The panel was sized once, when it was first opened, and never again — so
     rotating a phone, resizing a window, or opening it inside a preview pane
     that later changes size left it at the wrong geometry for the rest of the
     session. rAF-coalesced so a drag-resize does not thrash layout. */
  var resizePending = false;
  function handleViewportChange() {
    if (!state.iframe || resizePending) return;
    resizePending = true;
    requestAnimationFrame(function () {
      resizePending = false;
      if (state.iframe) sizeIframe(state.iframe);
    });
  }
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);

  function open() {
    if (!state.config || !state.config.active || pageExcluded(state.config)) return;
    if (!state.iframe) buildIframe();
    if (state.teaser) { markTeaserSeen(state.teaserKind); removeTeaser(); }
    requestAnimationFrame(function () {
      state.iframe.style.opacity = '1';
      state.iframe.style.pointerEvents = 'auto';
      state.iframe.style.transform = 'none';
    });
    state.open = true;
    if (state.launcherBtn) state.launcherBtn.setAttribute('aria-expanded', 'true');
    track('messenger_opened', {});
  }

  function close() {
    if (!state.iframe) return;
    state.iframe.style.opacity = '0';
    state.iframe.style.pointerEvents = 'none';
    if (!isSmallScreen()) state.iframe.style.transform = 'translateY(6px)';
    state.open = false;
    if (state.launcherBtn) {
      state.launcherBtn.setAttribute('aria-expanded', 'false');
      state.launcherBtn.focus({ preventScroll: true });
    }
  }

  function toggle() { state.open ? close() : open(); }

  /* ── Identity ── */
  function identify(token) {
    if (typeof token !== 'string' || token.length > 4096) return;
    lsSet(LS.token, token);
    state.identified = true;
  }

  function attachShopperToken() {
    var token = lsGet(LS.token);
    if (token) { state.identified = true; return; }
    if (!(CUSTOMER.id && CUSTOMER.email)) return;
    // Logged-in Shopify customer: ask the app proxy to sign our claims.
    var sid = ensureAnonId();
    var q = '/apps/grindctrl/messenger-identity?sid=' + encodeURIComponent(sid) +
      '&customer_id=' + encodeURIComponent(CUSTOMER.id) +
      '&customer_email=' + encodeURIComponent(CUSTOMER.email) +
      '&customer_name=' + encodeURIComponent(CUSTOMER.name);
    try {
      fetch(q).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
        if (data && data.authenticated && data.token) identify(data.token);
      }).catch(function () {});
    } catch (e) {}
  }

  /* ── Public API ── */
  var api = {
    open: open,
    close: close,
    toggle: toggle,
    identify: identify,
    logout: function () {
      lsRemove(LS.anon); lsRemove(LS.conv); lsRemove(LS.token);
      state.loggedOut = true;
      if (state.iframe) { state.iframe.parentNode.removeChild(state.iframe); state.iframe = null; state.booted = false; }
      state.open = false;
    },
    _version: '1.0.0'
  };

  function drainQueue() {
    var queued = window[GLOBAL];
    try {
      if (Array.isArray(queued)) {
        for (var i = 0; i < queued.length; i++) {
          var item = queued[i];
          if (item && typeof item[0] === 'string' && typeof api[item[0]] === 'function') {
            api[item[0]].apply(null, Array.prototype.slice.call(item, 1));
          }
        }
      }
    } catch (e) {}
    Object.defineProperty(window, GLOBAL, {
      configurable: true,
      value: api
    });
  }

  /* ── Boot ── */
  function boot() {
    drainQueue(); // API available immediately; calls run when ready below.
    fetchConfig(function (config) {
      state.config = config;
      if (!config || !config.active || pageExcluded(config)) return;
      state.locale = resolveLocale(config);
      buildLauncher();
      attachShopperToken();
      track('loader_initialized', {});

      if (config.available && config.aiEnabled) {
        if (config.behaviour.greetingEnabled) {
          setTimeout(function () {
            if (state.open) return;
            showTeaser(pick(config.behaviour.greeting) ||
              (state.locale === 'ar' ? 'مرحباً 👋 كيف نقدر نساعدك؟' : 'Hi 👋 How can we help?'), 'greeting');
          }, clampDelay(config.behaviour.greetingDelaySeconds));
        }
        if (config.behaviour.proactiveEnabled) {
          setTimeout(function () {
            if (state.open) return;
            showTeaser(pick(config.behaviour.welcomeSubtitle) ||
              (state.locale === 'ar' ? 'اسألنا أي شيء — نرد فوراً.' : 'Ask us anything — we reply instantly.'), 'proactive');
          }, clampDelay(config.behaviour.proactiveDelaySeconds));
        }
      }
    });
  }
  function clampDelay(seconds) {
    var n = Number(seconds);
    if (!isFinite(n)) return 6000;
    return Math.max(0, Math.min(n, 300)) * 1000;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
