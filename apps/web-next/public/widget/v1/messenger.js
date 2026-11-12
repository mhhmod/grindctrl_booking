/**
 * GRINDCTRL Support Messenger v1.2.0 — storefront loader.
 *
 * Design contract:
 * - Guest, never resident: one tiny script tag, one small launcher button in
 *   its own shadow root, and NO messenger surface until the shopper asks.
 *   The messenger itself is an iframe on grindctrl.cloud loaded on first
 *   open (perfect CSS/JS isolation from the merchant theme).
 * - Fails quiet: any error here must never affect the store page.
 * - One copy per page: the tag pasted twice, or added again by a tag
 *   manager, leaves the page to the first copy.
 * - Public API: window.GRINDCTRL_MESSENGER.open/close/toggle/identify/logout
 *   callable before init (queued), after init, repeatedly, safely.
 */
(function () {
  'use strict';

  /* Fixed body prevents iOS rubber-band/pan behind our frame. Independent
     windows share ownership, so closing chat cannot unlock an open Try-On. */
  function lockStorePage(owner, locked) {
    var saved = window.__gcShopperScrollLock;
    var root = document.documentElement;
    var body = document.body;
    var props = ['position', 'insetBlockStart', 'insetInlineStart', 'insetBlockEnd', 'insetInlineEnd', 'inlineSize'];
    var i;
    if (locked) {
      if (!saved) {
        saved = { x: window.scrollX, y: window.scrollY, overflow: root.style.overflow, body: {}, owners: {} };
        for (i = 0; i < props.length; i++) saved.body[props[i]] = body.style[props[i]];
        window.__gcShopperScrollLock = saved;
        root.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.insetBlockStart = -saved.y + 'px';
        body.style.insetInlineStart = -saved.x + 'px';
        body.style.insetBlockEnd = 'auto';
        body.style.insetInlineEnd = 'auto';
        body.style.inlineSize = '100%';
      }
      saved.owners[owner] = true;
      return;
    }
    if (!saved || !saved.owners[owner]) return;
    delete saved.owners[owner];
    for (var other in saved.owners) { if (saved.owners[other]) return; }
    for (i = 0; i < props.length; i++) body.style[props[i]] = saved.body[props[i]];
    root.style.overflow = saved.overflow;
    delete window.__gcShopperScrollLock;
    if (window.scrollX !== saved.x || window.scrollY !== saved.y) {
      try { window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' }); }
      catch (_) { window.scrollTo(saved.x, saved.y); }
    }
  }

  /* document.currentScript is null for some tag-manager and dynamically
     created scripts: then the tag is found by its address and attributes. */
  function findScript() {
    var current = document.currentScript;
    if (current && (current.getAttribute('data-key') || current.getAttribute('data-shop'))) return current;
    var tags = document.querySelectorAll('script[src*="/widget/v1/messenger.js"][data-key],script[src*="/widget/v1/messenger.js"][data-shop]');
    return tags.length ? tags[tags.length - 1] : current;
  }
  var SCRIPT = findScript();
  var PROXY_PATH = (SCRIPT && SCRIPT.getAttribute('data-proxy-path')) || '/apps/grindctrl';
  if (!/^\/(apps|a|community|tools)\/[A-Za-z0-9_-]{1,30}$/.test(PROXY_PATH)) return;
  var SHOP = SCRIPT && SCRIPT.getAttribute('data-shop');
  var KEY = (SCRIPT && SCRIPT.getAttribute('data-key')) || '';
  var LOCALE_HINT = (SCRIPT && SCRIPT.getAttribute('data-locale')) || '';
  /* The signed-in Shopify customer on this page, or '' for a guest. Only a
     hint for when to ask the App Proxy for a token: the proxy reads who is
     signed in from Shopify itself, never from this attribute. Older theme
     blocks also print the customer's email and name; nothing reads them. */
  var CUSTOMER_ID = (SCRIPT && SCRIPT.getAttribute('data-customer-id')) || '';
  /* Either identifier is a valid install. The Shopify app-embed block only
     knows the shop's permanent domain (zero merchant setup, nothing to
     paste), so requiring data-key here would make that entire install path
     dead on arrival. */
  if (!KEY && !SHOP) return;

  var GLOBAL = 'GRINDCTRL_MESSENGER';
  /* Claimed synchronously, before boot: two copies in <head> both run before
     DOMContentLoaded, so the public API (set at boot) cannot be the marker.
     The queue array keeps working as the public queue. */
  var claimed = window[GLOBAL];
  if (claimed && (claimed._version || claimed.__gcClaimed)) return;
  if (!Array.isArray(claimed)) claimed = window[GLOBAL] = [];
  try { Object.defineProperty(claimed, '__gcClaimed', { value: true }); } catch (e) { return; }
  var ORIGIN = window.location.origin;
  var APP_ORIGIN = (SCRIPT && SCRIPT.getAttribute('data-app-origin')) || new URL(SCRIPT.src).origin;
  /* Paste installs (data-gc-install="paste"): on product pages, and on
     Shopify listings whose snippet printed signed product cards, load the
     paste adapter, and the hosted Try-On engine once the adapter has found a
     product or the store said card pills are on. Try-On boots independently:
     a failed adapter must never delay Store Chat. The install signal is the
     config fetch below (its browser Origin is recorded server-side), sent
     whether or not Try-On loads. */
  function pasteLocale() {
    if (LOCALE_HINT === 'ar' || LOCALE_HINT === 'en') return LOCALE_HINT;
    var lang = String(document.documentElement.lang || '').toLowerCase().split(/[-_]/)[0];
    return lang === 'ar' || lang === 'en' ? lang : detectLocale();
  }
  var widgetLoads = {};
  function loadWidget(name, global) {
    if (window[global]) return Promise.resolve();
    if (widgetLoads[name]) return widgetLoads[name];
    widgetLoads[name] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.async = true;
      script.src = APP_ORIGIN + '/widget/v1/' + name + '?v=8604e4d2cd8e';
      script.onload = resolve;
      script.onerror = function () { delete widgetLoads[name]; reject(new Error('widget_unavailable')); };
      document.head.appendChild(script);
    });
    return widgetLoads[name];
  }

  /* A product or product cards described on this page, by any of the
     sources tryon-paste.js reads. A cheap look before loading it. */
  function websiteSignals() {
    if (/\/(products?|item)\/[^/]+/.test(window.location.pathname) || document.querySelector('button[name="add-to-cart"],button[name="add"],.single_add_to_cart_button')) return true;
    if (document.querySelector('[data-grindctrl-tryon][data-product-id],[data-grindctrl-card],meta[property^="product:"],' +
        'meta[property="og:type"][content="product"],[itemscope][itemtype*="schema.org/Product"]')) return true;
    // WooCommerce shop and category pages: its own product cards (the adapter checks the page is WooCommerce).
    if (document.querySelector('li.product .add_to_cart_button[data-product_id],.wc-block-grid__product,.wc-block-product')) return true;
    return Array.prototype.some.call(document.querySelectorAll('script[type="application/ld+json"]'), function (node) {
      try { return /"(?:https?:\/\/schema.org\/)?(?:Product|ProductGroup|ItemList)"/.test(JSON.stringify(JSON.parse(node.textContent))); } catch (_) { return false; }
    });
  }

  /* Client-side navigation and re-renders on a website: history changes,
     back and forward, and page markup changing (not our own button, pill,
     note or chat). Followers run once per quiet 300 ms. */
  var OWN_NODES = '.gc-tryon-btn,.gc-tryon-pill,.gc-tryon-note,.gc-tryon-live,.gc-tryon-sheet,[data-gc-chat-launcher],#gc-tryon-woo-css';
  var followers = [];
  function followPage(callback) {
    followers.push(callback);
    if (followers.length > 1) return;
    var timer = null;
    function changed() {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        for (var i = 0; i < followers.length; i++) { try { followers[i](); } catch (e) {} }
      }, 300);
    }
    // One wrapper per page whichever copy installed it; every listener hears its event.
    ['pushState', 'replaceState'].forEach(function (name) {
      var original = window.history[name];
      if (typeof original !== 'function' || original.__gcWrapped) return;
      var wrapped = function () {
        var result = original.apply(this, arguments);
        try { window.dispatchEvent(new Event('gc:locationchange')); } catch (e) {}
        return result;
      };
      wrapped.__gcWrapped = true;
      try { window.history[name] = wrapped; } catch (e) {}
    });
    window.addEventListener('gc:locationchange', changed);
    window.addEventListener('popstate', changed);
    window.addEventListener('hashchange', changed);
    if (!window.MutationObserver || !document.body) return;
    function foreign(node) {
      if (node.nodeType === 3) return true;
      if (node.nodeType !== 1 || node.matches(OWN_NODES)) return false;
      return !(node.tagName === 'SCRIPT' && /\/widget\/v1\//.test(node.src || '')) &&
        !(node.tagName === 'IFRAME' && /\/embed\/messenger/.test(node.src || ''));
    }
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var record = records[i];
        var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target && target.closest('.gc-tryon-btn,.gc-tryon-pill,.gc-tryon-sheet,[data-gc-chat-launcher]')) continue;
        if (Array.prototype.some.call(record.addedNodes, foreign) ||
            // Our own button taken away by a re-render counts: it may need putting back.
            Array.prototype.some.call(record.removedNodes, function (node) { return foreign(node) || (node.nodeType === 1 && node.matches('.gc-tryon-btn')); })) {
          changed();
          return;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* Website paste: the button for the product a page shows, or pills on
     its product cards, followed through client-side navigation. The adapter
     and engine load once; a page with nothing to show loads neither. */
  var website = { adapter: null, handle: null, busy: false, again: false };
  function syncWebsiteTryOn() {
    if (website.busy) { website.again = true; return; }
    if (website.handle) {
      website.adapter.refresh();
      website.handle.refresh();
      return;
    }
    if (!website.adapter && !websiteSignals()) return;
    website.busy = true;
    Promise.all([loadWidget('tryon-paste.js', 'GRINDCTRL_TRYON_PASTE').then(function () {
      if (!website.adapter) {
        website.adapter = window.GRINDCTRL_TRYON_PASTE.create({ script: SCRIPT, appOrigin: APP_ORIGIN,
          locale: pasteLocale(), visitorId: launchVisitorId(), preview: previewToken() });
      }
      return website.adapter.prepare();
    }), loadWidget('tryon-engine.js', 'GRINDCTRL_TRYON_ENGINE')]).then(function (ready) {
      if (ready[0]) website.handle = window.GRINDCTRL_TRYON_ENGINE.mount(website.adapter) || null;
    }).catch(function () { /* Store Chat remains available. */ }).then(function () {
      website.busy = false;
      if (website.again) { website.again = false; syncWebsiteTryOn(); }
    });
  }

  function bootPasteTryOn() {
    if (!SCRIPT || SCRIPT.dataset.gcInstall !== 'paste' || window.__gcPasteTryOn) return;
    var platform = SCRIPT.dataset.gcPlatform;
    if (platform === 'website') {
      window.__gcPasteTryOn = true;
      followPage(syncWebsiteTryOn);
      syncWebsiteTryOn();
      return;
    }
    var productPage = platform === 'shopify' &&
      /^\d+$/.test(SCRIPT.dataset.gcProduct || '') && /\/products\/[^/]+/.test(location.pathname) && !!document.querySelector('form[action*="/cart/add"]');
    var listing = platform === 'shopify' && !productPage &&
      !!document.querySelector('script[type="application/json"][data-gc-cards]');
    if (!productPage && !listing) return;
    window.__gcPasteTryOn = true;
    var adapter;
    pasteTryOnSettled = Promise.all([loadWidget('tryon-paste.js', 'GRINDCTRL_TRYON_PASTE').then(function () {
      adapter = window.GRINDCTRL_TRYON_PASTE.create({ script: SCRIPT, appOrigin: APP_ORIGIN,
        locale: pasteLocale(), visitorId: launchVisitorId(), preview: previewToken(), onProven: chatAfterProof });
      return adapter.prepare();
    }), loadWidget('tryon-engine.js', 'GRINDCTRL_TRYON_ENGINE')]).then(function (ready) {
      if (ready[0] && (!adapter.injectButton || adapter.placementTarget())) window.GRINDCTRL_TRYON_ENGINE.mount(adapter);
    }).catch(function () { /* Store Chat remains available. */ });
  }
  /* Settles once this page's Try-On start has (or has not) sent its own
     proof request; null when Try-On does not start on this page. */
  var pasteTryOnSettled = null;

  /* A Shopify store whose pasted code is not confirmed yet gets no Store
     Chat config. This page's signed render (the product tag, or the first
     signed product card of a listing) is the proof's second factor: send it
     once, proof only, then start Store Chat on this same page. Try-On never
     has to load for this, so a page without a buy form, a paused Try-On or
     a store out of looks still finishes the proof. The server runs every
     check of a Try-On request on it (rate limits, origin, signature, replay,
     then its own storefront check). */
  var SHOPIFY_ID_RE = /^[1-9]\d{0,19}$/;
  var MAC_RE = /^[a-f0-9]{64}$/;
  var proofSent = false;
  var proofDone = false;
  function signedPageClaim() {
    var d = SCRIPT.dataset;
    var site = d.gcSite || '';
    var shop = d.gcShop || '';
    if (SHOPIFY_ID_RE.test(d.gcProduct || '') && SHOPIFY_ID_RE.test(d.gcVariant || '') && MAC_RE.test(d.gcSignature || '')) {
      return { siteId: site, shopDomain: shop, productId: d.gcProduct, variantId: d.gcVariant,
        issuedAt: d.gcIssuedAt || '', customerId: d.gcCustomer || '', signature: d.gcSignature };
    }
    var node = document.querySelector('script[type="application/json"][data-gc-cards]');
    if (!node || node.getAttribute('data-gc-cards') !== site) return null;
    var data;
    try { data = JSON.parse(node.textContent); } catch (_) { return null; }
    if (!data || data.site !== site || data.shop !== shop || !Array.isArray(data.products)) return null;
    for (var i = 0; i < data.products.length && i < 50; i++) {
      var card = data.products[i];
      if (card && SHOPIFY_ID_RE.test(card.id) && SHOPIFY_ID_RE.test(card.variant) && MAC_RE.test(card.signature)) {
        return { siteId: site, shopDomain: shop, productId: card.id, variantId: card.variant, issuedAt: String(data.issuedAt),
          customerId: String(data.customer == null ? '' : data.customer), signature: card.signature };
      }
    }
    return null;
  }
  function proveShopFromPage() {
    if (proofSent || proofDone || state.host || !KEY || !SCRIPT || SCRIPT.dataset.gcInstall !== 'paste' ||
        SCRIPT.dataset.gcPlatform !== 'shopify') return;
    var claim = signedPageClaim();
    if (!claim) return;
    proofSent = true;
    var version = Number(SCRIPT.dataset.gcV);
    fetch(APP_ORIGIN + '/api/try-on/paste-context', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ key: KEY, proof: true, productId: claim.productId, variantId: claim.variantId,
        pageUrl: window.location.href, visitorId: launchVisitorId(), signed: claim,
        codeVersion: version >= 1 && version <= 99 && version % 1 === 0 ? version : 1 })
    }).then(function (res) { return res.ok ? res.json() : null; }).then(function (data) {
      if (data && data.proven === true) chatAfterProof();
    }).catch(function () { /* The next page sends its own. */ });
  }

  /* Pick a spot (Pack B): the dashboard opened this tab with a one-time
     edit link (?gc_pick=, then kept in this tab's sessionStorage across
     pages). Shoppers never have either, so for them this loads nothing.
     The engine verifies the link before any edit code loads. */
  function bootPickSpot() {
    var open = /[?&]gc_pick=/.test(window.location.search);
    if (!open) { try { open = !!window.sessionStorage.getItem('gc_pick'); } catch (_) { open = false; } }
    if (!open) return;
    loadWidget('tryon-engine.js', 'GRINDCTRL_TRYON_ENGINE').then(function () {
      window.GRINDCTRL_TRYON_ENGINE.bootPick(APP_ORIGIN);
    }).catch(function () { /* Store Chat remains available. */ });
  }
  /* Storage namespace has to be stable BEFORE the config response arrives,
     so it keys off whichever identifier the page gave us. */
  var NS = KEY || SHOP;
  var LS = {
    config: 'gc_msgr_' + NS + '_cfg',
    anon: 'gc_msgr_' + NS + '_anon',
    conv: 'gc_msgr_' + NS + '_conv',
    token: 'gc_msgr_token_' + NS,
    greeted: 'gc_msgr_' + NS + '_greeted',
    helloThisVisit: 'gc_msgr_' + NS + '_hello_visit',
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
    backdrop: null,
    pushedHistory: false,
    lift: 0,
    locale: detectLocale(),
    identified: false,
    identityPending: false,
    wooToken: null,
    loggedOut: false
  };

  function lsGet(name) { try { return window.localStorage.getItem(name); } catch (e) { return null; } }
  function ssGet(name) { try { return window.sessionStorage.getItem(name); } catch (e) { return null; } }
  function ssSet(name, value) { try { window.sessionStorage.setItem(name, value); } catch (e) {} }

  /* The v16 Store Chat (03-store-chat.md), for a store whose v16_chat flag
     is on: a bottom sheet on phones and a full-height panel docked on the
     bubble's side on desktop, closed by Escape and the back gesture as well
     as its own button, a bubble that rises above the theme's sticky Add to
     cart bar, and at most one first hello per visit. */
  function v16Chat() {
    var features = state.config && state.config.features;
    return Array.isArray(features) && features.indexOf('v16_chat') !== -1;
  }
  function onCheckout() {
    return /\/checkouts?(\/|$)/.test(window.location.pathname) || !!(window.Shopify && window.Shopify.Checkout);
  }

  /* Launch state (phase zero item 9). The visitor id the try-on scripts
     already keep on this store (gc_tryon_vid), so a holdout puts a visitor
     in the same arm for Store Chat and Try it on; and the owner's preview
     link, kept for its 24 hours, so the owner sees Store Chat before the
     store goes live. The server checks both. */
  function launchVisitorId() {
    var id = lsGet('gc_tryon_vid');
    if (id && /^[A-Za-z0-9_-]{16,64}$/.test(id)) return id;
    id = uuid() + uuid().slice(0, 8);
    lsSet('gc_tryon_vid', id);
    return /^[A-Za-z0-9_-]{16,64}$/.test(id) ? id : '';
  }
  function previewToken() {
    try {
      var fromUrl = new URLSearchParams(window.location.search).get('gc_preview');
      if (fromUrl && /^[A-Za-z0-9_.-]{20,512}$/.test(fromUrl)) {
        lsSet('gc_preview', JSON.stringify({ token: fromUrl, savedAt: Date.now() }));
        return fromUrl;
      }
      var saved = JSON.parse(lsGet('gc_preview') || 'null');
      if (saved && typeof saved.token === 'string' && Date.now() - saved.savedAt < 24 * 60 * 60 * 1000) return saved.token;
    } catch (e) {}
    return '';
  }
  // The theme editor always shows Store Chat, so the merchant can place it.
  function inThemeEditor() { return !!(window.Shopify && window.Shopify.designMode); }
  function launchHidden(config) {
    return !!(config && config.launch && config.launch.show === false) && !inThemeEditor();
  }
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
    var preview = previewToken();
    var url = APP_ORIGIN + '/api/messenger/config?' +
      (KEY ? 'key=' + encodeURIComponent(KEY) : 'shop=' + encodeURIComponent(SHOP)) +
      '&origin=' + encodeURIComponent(ORIGIN) +
      '&vid=' + encodeURIComponent(launchVisitorId()) +
      (preview ? '&preview=' + encodeURIComponent(preview) : '');
    fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject({ status: r.status }); }).then(function (data) {
      lsSet(LS.config, JSON.stringify({ fetchedAt: Date.now(), data: data }));
      done(data);
    }).catch(function (err) {
      var fallback = cachedConfig();
      // The status when the browser lets us read it; a refused origin gets
      // no CORS header, so it arrives as 0 and the server names the reason.
      track('config_fetch_failed', { status: err && typeof err.status === 'number' ? err.status : 0 });
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
  /* radiusStyle was never read by this loader at all: the launcher was a
     hardcoded pill, the panel a hardcoded 16px, the teaser a hardcoded 14px.
     Kept in step with lib/messenger/appearance-geometry.ts, which the
     dashboard preview uses, so preview and storefront cannot disagree. */
  function radiusStyle() {
    var r = state.config && state.config.appearance && state.config.appearance.radiusStyle;
    return r === 'rounded' || r === 'sharp' ? r : 'soft';
  }
  function launcherRadius() {
    var r = radiusStyle();
    return r === 'rounded' ? '18px' : r === 'sharp' ? '6px' : '999px';
  }
  function panelRadius() {
    var r = radiusStyle();
    return r === 'rounded' ? '14px' : r === 'sharp' ? '4px' : '20px';
  }

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
          conversationId: lsGet(LS.conv) || undefined, payload: payload || {},
          // The visitor's holdout arm, so both arms are measured (item 22).
          bucket: (state.config && state.config.launch && state.config.launch.bucket) || undefined })
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
    // Lets a floating Try-On pill take the other corner (tryon-engine.js).
    hostEl.setAttribute('data-gc-chat-launcher', '');
    // Themes such as Dawn hide div:empty, and a shadow host has no light-DOM
    // children, so the display must be explicit or the launcher renders 0x0.
    hostEl.style.cssText = 'display:block!important;position:fixed;inset:auto;bottom:' + (20 + state.lift) + 'px;z-index:2147482000;' +
      (state.config.appearance.position === 'bottom-left' ? 'left:' : 'right:') + offset('x') +
      ';--gc-accent:' + safeColor(state.config.appearance.accentColor);
    var root = hostEl.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS_TEXT;
    root.appendChild(style);

    var label = pick(state.config.appearance.launcherLabel);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn bottom icon-only';
    btn.setAttribute('aria-label', label || (state.locale === 'ar' ? 'الدعم' : 'Support'));
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = iconSvg(state.config.appearance.launcherIcon, state.config.appearance.launcherCustomIconUrl);
    /* Both axes, unconditionally. The `.btn.icon-only` class below is applied
       to every launcher and hardcodes 56x56, and the previous attempt gated
       the width on a flag derived from launcherLabel — which most stores set,
       so the width kept coming from the class and the button never changed.
       The rendered button IS always icon-only: its content is the SVG, and
       the label is only ever the aria-label. */
    var size = launcherSize();
    btn.style.height = size + 'px';
    btn.style.width = size + 'px';
    if (state.lift) btn.style.bottom = (20 + state.lift) + 'px';
    btn.style.borderRadius = launcherRadius();
    btn.addEventListener('click', function () { toggle(); });
    btn.addEventListener('pointerenter', warmPanel);
    btn.addEventListener('touchstart', warmPanel, { passive: true });
    btn.addEventListener('focus', warmPanel);
    root.appendChild(btn);

    state.host = hostEl;
    state.launcherBtn = btn;
    state.teaserHost = root;
    document.body.appendChild(hostEl);
    applyAccent(btn);
    try { window.dispatchEvent(new Event('gc:chat-launcher')); } catch (e) {}
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
    // v16: one first hello per visit, never on checkout.
    if (v16Chat() && (ssGet(LS.helloThisVisit) || onCheckout())) return;
    if (v16Chat()) ssSet(LS.helloThisVisit, '1');
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
    el.style.borderRadius = panelRadius();
    var clear = launcherSize() + 28;
    if (state.config.appearance.position === 'bottom-left') el.style.left = clear + 'px';
    else el.style.right = clear + 'px';
    if (state.lift) el.style.bottom = (20 + state.lift) + 'px';
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
      '&origin=' + encodeURIComponent(ORIGIN) +
      // The shopper's anonId comes over postMessage (sendSession), like the
      // token: never in the address, where logs and referrers keep it.
      '&session=1';
    // The token itself never goes in the address either. The panel is told
    // one is coming, asks for it once it is listening, and waits for it
    // before loading the conversation.
    if (currentToken() || state.identityPending) params += '&identity=1';
    var frame = document.createElement('iframe');
    frame.src = APP_ORIGIN + '/embed/messenger' + params;
    frame.title = state.locale === 'ar' ? 'محادثة الدعم' : 'Support chat';
    // v16: the composer's microphone uses the browser's own speech input.
    frame.setAttribute('allow', v16Chat() ? 'clipboard-write; microphone' : 'clipboard-write');
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
  /* visibility goes with opacity: a closed panel used to stay in the tab
     order and the accessibility tree while invisible. Visibility switches
     at the end of the fade out and at once on the way in. */
  var FRAME_BASE = 'position:fixed;z-index:2147482001;border:none;background-color:transparent;' +
    'transition:opacity .18s ease,transform .18s ease,visibility .18s;color-scheme:normal;';

  function sizeIframe(frame) {
    var small = isSmallScreen();
    var css = FRAME_BASE;

    if (v16Chat()) {
      css += v16Geometry(small);
    } else if (small) {
      var viewport = window.visualViewport;
      // iOS keyboards resize/pan the visual viewport without window.resize.
      // Offsets are relative to the layout viewport used by position:fixed.
      css += viewport
        ? 'inset:auto;top:' + viewport.offsetTop + 'px;left:' + viewport.offsetLeft +
          'px;width:' + viewport.width + 'px;height:' + viewport.height + 'px;'
        : 'inset:0;width:100vw;height:100dvh;';
      css += 'border-radius:0;box-shadow:none;';
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
        'border-radius:' + panelRadius() + ';overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.24);';
    }

    // Rewriting cssText drops the open/closed visuals, so restate them.
    css += state.open
      ? 'opacity:1;pointer-events:auto;transform:none;visibility:visible;'
      : 'opacity:0;pointer-events:none;visibility:hidden;' + closedTransform(small);

    frame.style.cssText = css;
    lockPage(state.open && small);
    if (frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'grindctrl-messenger:viewport', fullBleed: small }, APP_ORIGIN);
    }
  }

  /* On a phone the open chat covers the store, so the store page holds still
     behind it: the thread is the one thing that scrolls, and closing puts
     the page back exactly where it was, even if the keyboard panned it. A
     class rather than the inline style the try-on sheet saves and restores,
     so neither lock can undo the other. */
  function lockPage(locked) {
    if (!document.getElementById('gc-msgr-lock-css')) {
      var style = document.createElement('style');
      style.id = 'gc-msgr-lock-css';
      style.textContent = '.gc-scroll{overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}@supports not selector(::-webkit-scrollbar){.gc-scroll{scrollbar-width:thin;scrollbar-color:color-mix(in oklch,currentColor 25%,transparent) transparent}}.gc-scroll::-webkit-scrollbar{width:6px;height:6px}.gc-scroll::-webkit-scrollbar-track{background:transparent}.gc-scroll::-webkit-scrollbar-thumb{border-radius:999px;background:color-mix(in oklch,currentColor 25%,transparent)}.gc-scroll::-webkit-scrollbar-button{display:none}@media(pointer:coarse){.gc-scroll{scrollbar-width:none}.gc-scroll::-webkit-scrollbar{display:none}}html.gc-msgr-lock{overflow:hidden!important;overscroll-behavior:none}';
      document.head.appendChild(style);
    }
    if (locked) document.documentElement.classList.add('gc-msgr-lock');
    else document.documentElement.classList.remove('gc-msgr-lock');
    lockStorePage('chat', locked);
  }

  function closedTransform(small) {
    if (!v16Chat()) return small ? '' : 'transform:translateY(6px);';
    if (small) return 'transform:translateY(24px);';
    var posLeft = state.config && state.config.appearance.position === 'bottom-left';
    return 'transform:translateX(' + (posLeft ? '-' : '') + '24px);';
  }

  /* v16: about 92 percent of the screen as a bottom sheet on phones, held
     above an on-screen keyboard; on desktop 400 pixels wide on the bubble's
     side and as tall as the window, over the page without dimming it. */
  function v16Geometry(small) {
    if (small) {
      var viewport = window.visualViewport;
      var height = viewport ? viewport.height : window.innerHeight;
      var top = (viewport ? viewport.offsetTop : 0) + Math.round(height * 0.08);
      return 'inset:auto;left:0;right:auto;top:' + top + 'px;width:100%;height:' + Math.round(height * 0.92) + 'px;' +
        'border-radius:' + panelRadius() + ' ' + panelRadius() + ' 0 0;overflow:hidden;box-shadow:0 -8px 32px rgba(0,0,0,.18);';
    }
    var posLeft = state.config && state.config.appearance.position === 'bottom-left';
    // A landscape phone still docks by width. Safari's keyboard only
    // shrinks the visual viewport, so bound that dock to it when needed.
    var visual = window.visualViewport;
    var keyboard = visual && visual.height < window.innerHeight - 80 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var vertical = keyboard ? 'top:' + visual.offsetTop + 'px;bottom:auto;height:' + visual.height + 'px;'
      : 'top:0;bottom:0;height:100svh;height:100dvh;';
    return 'inset:auto;' + vertical + 'width:min(400px,100vw);' +
      (posLeft ? 'left:0;right:auto;' : 'right:0;left:auto;') +
      'border-radius:0;overflow:hidden;box-shadow:0 0 32px rgba(0,0,0,.16);';
  }

  /* v16 on phones: the store dims behind the sheet, and a tap on it closes. */
  function showBackdrop() {
    if (!v16Chat() || !isSmallScreen() || state.backdrop) return;
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'display:block!important;position:fixed;inset:0;z-index:2147482000;background:rgba(0,0,0,.4);';
    el.style.touchAction = 'none';
    el.addEventListener('click', function () { close(); });
    document.body.appendChild(el);
    state.backdrop = el;
  }
  function hideBackdrop() {
    if (state.backdrop && state.backdrop.parentNode) state.backdrop.parentNode.removeChild(state.backdrop);
    state.backdrop = null;
  }

  /* v16: the bubble rises above a sticky or fixed Add to cart bar at the
     bottom of the screen, by the bar's height plus a margin. */
  var CART_SELECTOR = 'form[action*="/cart/add"],button[name="add"],[data-add-to-cart],.product-form__submit,form.cart,.single_add_to_cart_button';
  function stickyCartLift() {
    var found = document.querySelectorAll(CART_SELECTOR);
    var lift = 0;
    for (var i = 0; i < found.length && i < 40; i++) {
      var el = found[i];
      while (el && el !== document.body) {
        var position = window.getComputedStyle(el).position;
        if (position === 'fixed' || position === 'sticky') {
          var box = el.getBoundingClientRect();
          if (box.height > 0 && box.top < window.innerHeight && box.bottom >= window.innerHeight - 2) {
            lift = Math.max(lift, Math.ceil(window.innerHeight - box.top) + 12);
          }
          break;
        }
        el = el.parentElement;
      }
    }
    return Math.min(lift, Math.round(window.innerHeight / 2));
  }
  var liftPending = false;
  function updateLift() {
    if (!v16Chat() || liftPending) return;
    liftPending = true;
    requestAnimationFrame(function () {
      liftPending = false;
      var lift = stickyCartLift();
      if (lift === state.lift) return;
      state.lift = lift;
      if (state.host) state.host.style.bottom = (20 + lift) + 'px';
      if (state.launcherBtn) state.launcherBtn.style.bottom = (20 + lift) + 'px';
      if (state.teaser) state.teaser.style.bottom = (20 + lift) + 'px';
    });
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
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
  }

  function open() {
    if (!state.config || !state.config.active || pageExcluded(state.config)) return;
    if (!state.iframe) buildIframe();
    if (!state.iframe) return;
    if (state.teaser) { markTeaserSeen(state.teaserKind); removeTeaser(); }
    state.open = true;
    if (v16Chat()) {
      showBackdrop();
      // The variant may have changed since the panel was built.
      sendPageProduct();
      // The phone's back gesture closes the panel, not the store page.
      try { window.history.pushState({ gcChat: true }, ''); state.pushedHistory = true; } catch (e) {}
    }
    requestAnimationFrame(function () {
      if (!state.iframe) return;
      sizeIframe(state.iframe);
      if (v16Chat()) {
        // Focus moves into the composer.
        try { state.iframe.focus({ preventScroll: true }); } catch (e) {}
        if (state.iframe.contentWindow) state.iframe.contentWindow.postMessage({ type: 'grindctrl-messenger:opened' }, APP_ORIGIN);
      }
    });
    if (state.launcherBtn) state.launcherBtn.setAttribute('aria-expanded', 'true');
    track('messenger_opened', {});
  }

  function close(fromHistory) {
    if (!state.iframe) return;
    var wasOpen = state.open;
    state.open = false;
    sizeIframe(state.iframe);
    hideBackdrop();
    if (state.pushedHistory) {
      state.pushedHistory = false;
      if (fromHistory !== true) { try { window.history.back(); } catch (e) {} }
    }
    if (state.launcherBtn) {
      state.launcherBtn.setAttribute('aria-expanded', 'false');
      if (wasOpen) state.launcherBtn.focus({ preventScroll: true });
    }
  }

  window.addEventListener('popstate', function () {
    if (state.open && state.pushedHistory) close(true);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && state.open && v16Chat()) close();
  });
  window.addEventListener('scroll', updateLift, { passive: true });
  window.addEventListener('resize', updateLift);

  function toggle() { state.open ? close() : open(); }

  /* On a phone the panel is full-bleed, so it covers the launcher — the only
     control that could close it. A shopper who opened the chat had no way
     back to the store short of reloading the page. The panel now renders its
     own close button and asks us to shut, over postMessage, because it lives
     in an iframe on our origin and cannot reach this code directly.

     Trust is established by identity, not by origin string: the message must
     come from the very window we created. Nothing else on the page, and no
     other frame, can forge that. */
  window.addEventListener('message', function (event) {
    if (!state.iframe || event.source !== state.iframe.contentWindow) return;
    var data = event.data;
    if (data && data.type === 'grindctrl-messenger:close') close();
    if (data && data.type === 'grindctrl-messenger:identity-request') {
      sendSession();
      var token = currentToken();
      // While the proxy is still answering, identify() sends the token when
      // it lands; otherwise the panel learns there is none and stops waiting.
      if (token || !state.identityPending) sendIdentity(token);
    }
    if (data && data.type === 'grindctrl-messenger:ready') {
      handleViewportChange();
      // Built by this very open: the panel was not listening yet when asked.
      if (state.open && v16Chat() && state.iframe.contentWindow) {
        state.iframe.contentWindow.postMessage({ type: 'grindctrl-messenger:opened' }, APP_ORIGIN);
      }
      sendPageProduct();
    }
    // v16: Try it on from "You're viewing" opens the store's own try-on.
    if (data && data.type === 'grindctrl-messenger:try-on' && v16Chat()) {
      var tryOn = document.querySelector('.gc-tryon-btn');
      if (tryOn) { close(); tryOn.click(); }
    }
    if (data && data.type === 'grindctrl-messenger:cart-request') { sendCart(); watchCart(); }
  });

  /* ── The product on this page (v16, Chat-Home "You're viewing") ──
     On a product page the panel shows the piece the shopper is looking at,
     with the variant picked in the theme's own form, its price in the
     shopper's currency, and Try it on when the store's try-on button is
     on the page. Read from the store's own product JSON, once a page. */
  var pageProduct = null;

  /* WooCommerce: the GRINDCTRL plugin (integrations/woocommerce) prints
     window.grindctrlWoo with the product on a product page and the store's
     Store API root. Like Shopify's JSON it is the store's own page data,
     used for display only. */
  function woo() {
    var w = window.grindctrlWoo;
    return w && typeof w === 'object' && w.platform === 'woocommerce' ? w : null;
  }
  function currencyDigits(currency) {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: currency }).resolvedOptions().maximumFractionDigits; } catch (e) { return 2; }
  }
  // The panel and the cart contract count in the currency's ISO minor unit.
  function decimalToMinor(amount, currency) {
    var value = Number(amount);
    if (amount === '' || amount === null || !isFinite(value) || value < 0) return null;
    return Math.round(value * Math.pow(10, currencyDigits(currency)));
  }
  // The Store API counts in the store's own minor unit, which a merchant can set.
  function storeMinorToMinor(amount, unit, currency) {
    var value = parseInt(amount, 10);
    if (!isFinite(value) || value < 0 || typeof unit !== 'number') return null;
    return Math.round(value * Math.pow(10, currencyDigits(currency) - unit));
  }
  function slugFrom(url) {
    try {
      var parts = new URL(url, window.location.href).pathname.split('/').filter(Boolean);
      return parts.length ? decodeURIComponent(parts[parts.length - 1]) : '';
    } catch (e) { return ''; }
  }
  function sameOriginUrl(url) {
    try {
      var parsed = new URL(url, window.location.href);
      return parsed.origin === window.location.origin ? parsed.href : '';
    } catch (e) { return ''; }
  }
  function wooPageProduct(w) {
    var p = w.product;
    if (!p || typeof p !== 'object' || !/^\d{1,20}$/.test(String(p.id)) || typeof p.name !== 'string') return null;
    var currency = typeof p.currency === 'string' ? p.currency : '';
    var variants = (Array.isArray(p.variations) ? p.variations : []).slice(0, 50).map(function (v) {
      var attributes = v && v.attributes && typeof v.attributes === 'object' ? v.attributes : {};
      var title = Object.keys(attributes).map(function (k) { return attributes[k]; }).filter(Boolean).join(' / ');
      return { id: v && v.id, title: String(title), price: decimalToMinor(v && v.price, currency), imageUrl: v && v.image,
        priceAmount: v && v.price,
        available: v && typeof v.in_stock === 'boolean' ? v.in_stock : undefined };
    });
    if (!variants.length) variants = [{ id: p.id, title: '', price: decimalToMinor(p.price, currency), priceAmount: p.price }];
    var image = typeof p.image === 'string' ? p.image : '';
    return {
      handle: slugFrom(p.url) || String(p.id),
      title: p.name,
      imageUrl: /^https:\/\//.test(image) ? image : '',
      variants: variants,
      description: p.description || p.short_description || '',
      availability: p.in_stock === true ? 'in_stock' : p.in_stock === false ? 'out_of_stock' : 'unknown',
      currency: currency
    };
  }
  function pageHandle() {
    var match = window.location.pathname.match(/\/products\/([^/?#]+)/);
    if (!match) return '';
    try { return decodeURIComponent(match[1]); } catch (e) { return ''; }
  }
  // Any other website: no Shopify or WooCommerce data to read.
  function genericSite() { return !SHOP && !woo() && !window.Shopify; }
  /* The same reading of JSON-LD, microdata, Open Graph and the merchant's
     tag as the website Try-On button (tryon-paste.js), never a copy of it.
     Read fresh each time: a client-side route may have changed the product. */
  function websitePageProduct() {
    if (!websiteSignals()) return Promise.resolve(null);
    return loadWidget('tryon-paste.js', 'GRINDCTRL_TRYON_PASTE').then(function () {
      var found = window.GRINDCTRL_TRYON_PASTE.detectWebsiteProduct();
      if (!found || !found.title) return null;
      var currency = typeof found.currency === 'string' && /^[A-Z]{3}$/.test(found.currency) ? found.currency : '';
      return {
        handle: found.id,
        title: found.title,
        imageUrl: found.imageUrl,
        currency: currency,
        description: found.description || '',
        availability: found.availability || 'unknown',
        sizes: found.sizes || [],
        // The chat panel takes a numeric variant id or none.
        variants: [{ id: /^\d{1,20}$/.test(String(found.variantId || '')) ? String(found.variantId) : '', title: '',
           price: currency ? decimalToMinor(found.price, currency) : null, priceAmount: found.price }]
      };
    }).catch(function () { return null; });
  }
  function loadPageProduct() {
    if (genericSite()) return websitePageProduct();
    if (pageProduct) return pageProduct;
    var w = woo();
    if (w) return (pageProduct = Promise.resolve(wooPageProduct(w)));
    var handle = pageHandle();
    if (!handle || !window.Shopify) return (pageProduct = Promise.resolve(null));
    var root = ((window.Shopify.routes && window.Shopify.routes.root) || '/').replace(/\/?$/, '/');
    pageProduct = fetch(root + 'products/' + encodeURIComponent(handle) + '.js', { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (product) {
        if (!product || !Array.isArray(product.variants) || !product.variants.length) return null;
        var image = typeof product.featured_image === 'string' ? product.featured_image : '';
        if (image.indexOf('//') === 0) image = 'https:' + image;
        return { handle: handle, title: product.title || '', imageUrl: /^https:\/\//.test(image) ? image : '', variants: product.variants,
          description: product.description || '', availability: product.available === true ? 'in_stock' : product.available === false ? 'out_of_stock' : 'unknown' };
      })
      .catch(function () { return null; });
    return pageProduct;
  }
  function pickedVariantId() {
    var variation = document.querySelector('form.variations_form [name="variation_id"]');
    if (variation && /^[1-9]\d*$/.test(variation.value)) return variation.value;
    var input = document.querySelector('form[action*="/cart/add"] [name="id"]');
    if (input && /^\d+$/.test(input.value)) return input.value;
    try { return new URLSearchParams(window.location.search).get('variant') || ''; } catch (e) { return ''; }
  }
  var sentPageProduct = '';
  // onlyChanged: after a page change, post only when the product shown is a different one.
  function sendPageProduct(onlyChanged) {
    if (!v16Chat() || !state.iframe || !state.iframe.contentWindow) return;
    loadPageProduct().then(function (product) {
      if (!state.iframe || !state.iframe.contentWindow) return;
      var sent = product ? product.handle + '|' + product.imageUrl + '|' + pickedVariantId() : '';
      if (onlyChanged === true && sent === sentPageProduct) return;
      sentPageProduct = sent;
      if (!product) {
        // A client-side route away from a product: the panel stops showing it.
        if (onlyChanged === true) state.iframe.contentWindow.postMessage({ type: 'grindctrl-messenger:page-product', product: null }, APP_ORIGIN);
        return;
      }
      var wanted = pickedVariantId();
      var variant = product.variants[0];
      for (var i = 0; i < product.variants.length; i++) {
        if (String(product.variants[i].id) === wanted) { variant = product.variants[i]; break; }
      }
      var currency = product.currency || (window.Shopify && window.Shopify.currency && window.Shopify.currency.active);
      var image = typeof variant.imageUrl === 'string' && /^https:\/\//.test(variant.imageUrl) ? variant.imageUrl : product.imageUrl;
      state.iframe.contentWindow.postMessage({
        type: 'grindctrl-messenger:page-product',
        product: {
          handle: product.handle,
          title: product.title,
          url: window.location.href,
          description: String(product.description || '').replace(/<[^>]*>/g, ' ').slice(0, 600),
          availability: typeof variant.available === 'boolean' ? (variant.available ? 'in_stock' : 'out_of_stock') : product.availability || 'unknown',
          sizes: product.sizes || product.variants.slice(0, 30).map(function (v) { return String(v.title || '').slice(0, 80); }),
          imageUrl: image,
          variantId: String(variant.id),
          variantTitle: variant.title || '',
          priceMinor: typeof variant.price === 'number' ? variant.price : null,
          price: variant.priceAmount != null ? String(variant.priceAmount).slice(0, 20) : undefined,
          currency: typeof currency === 'string' ? currency : null,
          tryOn: !!document.querySelector('.gc-tryon-btn')
        }
      }, APP_ORIGIN);
    });
  }

  /* ── The cart (phase zero item 10) ──
     For a store with the big-order rule on, the panel asks for the cart.
     Only this page can read Shopify's /cart.js (it is on the store's own
     origin), so this script reads it and hands the panel a small summary:
     the total, the currency, and each line's handle, variant, title,
     quantity and unit price, all in minor units as Shopify gives them. It
     reads again shortly after the theme adds to, changes or clears the
     cart, seen through PerformanceObserver so nothing on the page is
     wrapped. Any failure is silent. */
  var cartWatched = false;
  var cartTimer = null;

  function cartUrl() {
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.replace(/\/?$/, '/') + 'cart.js';
  }

  function postCart(summary) {
    if (!state.iframe || !state.iframe.contentWindow) return;
    state.iframe.contentWindow.postMessage({ type: 'grindctrl-messenger:cart', cart: summary }, APP_ORIGIN);
  }

  // WooCommerce's Store API cart, read from the store's own origin only.
  function sendWooCart(w) {
    var url = sameOriginUrl(typeof w.storeApi === 'string' ? w.storeApi.replace(/\/?$/, '/') + 'cart' : '');
    if (!url) return;
    fetch(url, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cart) {
        var totals = cart && cart.totals;
        if (!totals || !Array.isArray(cart.items)) return;
        var currency = totals.currency_code;
        postCart({
          totalMinor: storeMinorToMinor(totals.total_price, totals.currency_minor_unit, currency),
          currency: currency,
          items: cart.items.slice(0, 50).map(function (item) {
            var prices = item.prices || {};
            return {
              handle: slugFrom(item.permalink),
              variantId: item.id,
              title: item.name,
              quantity: item.quantity,
              priceMinor: storeMinorToMinor(prices.price, prices.currency_minor_unit, currency)
            };
          })
        });
      })
      .catch(function () {});
  }

  function sendCart() {
    if (!state.iframe || !state.iframe.contentWindow) return;
    var w = woo();
    if (w) return sendWooCart(w);
    if (!window.Shopify) return;
    fetch(cartUrl(), { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cart) {
        if (!cart || !Array.isArray(cart.items) || !state.iframe || !state.iframe.contentWindow) return;
        var summary = {
          totalMinor: cart.total_price,
          currency: cart.currency,
          items: cart.items.slice(0, 50).map(function (item) {
            return {
              handle: item.handle,
              variantId: item.variant_id,
              title: item.title,
              quantity: item.quantity,
              priceMinor: typeof item.final_price === 'number' ? item.final_price : item.price
            };
          })
        };
        postCart(summary);
      })
      .catch(function () {});
  }

  function watchCart() {
    if (cartWatched || typeof PerformanceObserver === 'undefined') return;
    cartWatched = true;
    try {
      new PerformanceObserver(function (list) {
        var changed = list.getEntries().some(function (entry) {
          // Shopify's cart endpoints, and WooCommerce's AJAX and Store API
          // writes (its cart reads are left out: this script makes them).
          return /\/cart\/(add|change|update|clear)(\.js)?(\?|$)/.test(entry.name) ||
            /[?&]wc-ajax=(add_to_cart|remove_from_cart)(&|$)/.test(entry.name) ||
            /\/wc\/store\/v1\/(cart\/(add-item|remove-item|update-item)|batch)(\?|$)/.test(entry.name);
        });
        if (!changed) return;
        clearTimeout(cartTimer);
        cartTimer = setTimeout(sendCart, 400);
      }).observe({ type: 'resource', buffered: false });
    } catch (e) {}
  }

  /* Opening felt slow because the iframe was created by the click itself:
     the shopper waited on a document fetch and a React hydration before
     anything appeared. Warm it on the first sign of intent instead — hover,
     the touch that precedes the tap, or keyboard focus — and on an idle
     moment for shoppers who never touch it first. Cheap: this is the same
     request the open would have made, just earlier. */
  function warmPanel() {
    if (state.iframe) return;
    buildIframe();
  }

  /* ── Identity ── */
  /* A token speaks for one customer for 12 hours (lib/messenger/identity.ts).
     It is kept with the customer it was issued for and when, so it is never
     sent for anyone else: not after a logout, not after another customer
     signs in on the same browser, and not once it has run out. */
  var TOKEN_FRESH_MS = 11 * 60 * 60 * 1000;

  function storedToken() {
    var raw = lsGet(LS.token);
    if (!raw) return null;
    try {
      var saved = JSON.parse(raw);
      if (saved && typeof saved.t === 'string' && typeof saved.c === 'string' && typeof saved.at === 'number') return saved;
    } catch (e) {}
    // A bare token from an older loader: whose it is cannot be known.
    return null;
  }

  /* A WordPress shopper's token comes from the plugin's own route and lasts
     ten minutes (the plugin signs it with the site's pairing secret). It is
     kept in memory only: a reload asks again, so it never outlives the login
     it speaks for. */
  var WOO_TOKEN_FRESH_MS = 8 * 60 * 1000;

  function wooIdentityEndpoint() {
    var w = woo();
    if (!w || typeof w.restNonce !== 'string' || typeof w.identityUrl !== 'string') return null;
    try {
      var url = new URL(w.identityUrl, window.location.href);
      // Same origin only: the nonce and the session cookie go nowhere else.
      return url.origin === window.location.origin ? url : null;
    } catch (e) { return null; }
  }

  function currentToken() {
    if (state.wooToken) return Date.now() - state.wooToken.at < WOO_TOKEN_FRESH_MS ? state.wooToken.t : null;
    var saved = storedToken();
    if (!saved || saved.c !== CUSTOMER_ID || saved.p !== PROXY_PATH || !(Date.now() - saved.at < TOKEN_FRESH_MS)) return null;
    return saved.t;
  }

  function sendSession() {
    if (state.iframe && state.iframe.contentWindow) {
      state.iframe.contentWindow.postMessage({ type: 'grindctrl-messenger:session', anonId: ensureAnonId() }, APP_ORIGIN);
    }
  }

  function sendIdentity(token) {
    if (state.iframe && state.iframe.contentWindow) {
      state.iframe.contentWindow.postMessage({ type: 'grindctrl-messenger:identify', token: token || null }, APP_ORIGIN);
    }
  }

  function identify(token) {
    if (typeof token !== 'string' || token.length > 4096) return;
    if (wooIdentityEndpoint()) {
      state.wooToken = { t: token, at: Date.now() };
      state.identified = true;
      sendIdentity(token);
      return;
    }
    lsSet(LS.token, JSON.stringify({ t: token, c: CUSTOMER_ID, p: PROXY_PATH, at: Date.now() }));
    state.identified = true;
    // Storage cannot cross the origin boundary, so the panel gets it here,
    // whether it is waiting for it or already loaded.
    sendIdentity(token);
  }

  function attachWooToken(endpoint) {
    state.wooToken = null;
    state.identityPending = true;
    var done = function () {
      state.identityPending = false;
      if (!currentToken()) sendIdentity(null);
    };
    try {
      endpoint.searchParams.set('sid', ensureAnonId());
      fetch(endpoint.toString(), {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-WP-Nonce': window.grindctrlWoo.restNonce }
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && typeof data.token === 'string') identify(data.token);
          done();
        })
        .catch(done);
    } catch (e) { done(); }
  }

  function attachShopperToken() {
    var wooEndpoint = wooIdentityEndpoint();
    if (wooEndpoint) {
      if (currentToken()) { state.identified = true; return; }
      attachWooToken(wooEndpoint);
      return;
    }
    if (currentToken()) { state.identified = true; return; }
    // Logged out, someone else, run out, or from an older loader: it must
    // not speak for whoever is here now.
    lsRemove(LS.token);
    if (!CUSTOMER_ID) return;
    // A signed-in customer, with or without an email: ask the App Proxy,
    // which signs who Shopify says is signed in, bound to this session.
    state.identityPending = true;
    var done = function () {
      state.identityPending = false;
      // A panel waiting for a token that is not coming stops waiting.
      if (!currentToken()) sendIdentity(null);
    };
    try {
      fetch(PROXY_PATH + '/messenger-identity?sid=' + encodeURIComponent(ensureAnonId()))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.authenticated && data.token) identify(data.token);
          done();
        })
        .catch(done);
    } catch (e) { done(); }
  }

  /* ── Public API ── */
  var api = {
    open: open,
    close: close,
    toggle: toggle,
    identify: identify,
    logout: function () {
      lsRemove(LS.anon); lsRemove(LS.conv); lsRemove(LS.token);
      state.wooToken = null;
      state.loggedOut = true;
      if (state.iframe) { state.iframe.parentNode.removeChild(state.iframe); state.iframe = null; state.booted = false; }
      state.open = false;
      // An open chat taken away must not leave the store page held or dimmed.
      lockPage(false);
      hideBackdrop();
    },
    _version: '1.1.0'
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
    try { bootPasteTryOn(); } catch (_) { /* isolated from chat */ }
    try { bootPickSpot(); } catch (_) { /* isolated from chat */ }
    fetchConfig(startChat);
  }
  /* A Shopify store's first product page visit can confirm it (tryon-paste.js
     onProven). Its config was refused a moment ago, so ask once more: Store
     Chat then appears on this same page instead of the next one. */
  function chatAfterProof() {
    proofDone = true;
    if (!state.host) fetchConfig(startChat);
  }
  function startChat(config) {
    if (state.host) return;
    state.config = config;
    if (!config) {
      // Refused (an unconfirmed Shopify paste store, among others): finish
      // the proof from this page, after Try-On's own attempt if it makes one.
      (pasteTryOnSettled || Promise.resolve()).then(proveShopFromPage);
      return;
    }
    if (!config.active || pageExcluded(config) || launchHidden(config)) return;
    state.locale = resolveLocale(config);
    if (v16Chat()) state.lift = stickyCartLift();
    // A website's client-side routes change the piece the panel shows.
    if (v16Chat() && genericSite()) followPage(function () { sendPageProduct(true); });
    buildLauncher();
    attachShopperToken();
    track('loader_initialized', {});

    /* Respect Save-Data and 2g: on a metered or slow connection an unused
       preload is a real cost to the shopper, and the click-time fetch is
       the lesser evil. */
    var conn = navigator.connection;
    var frugal = conn && (conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || ''));
    // v16 builds the panel on the first sign of intent, never on page load.
    if (!frugal && !v16Chat()) {
      var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 2500); };
      idle(function () { warmPanel(); }, { timeout: 6000 });
    }

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
            (state.locale === 'ar' ? 'اسألنا أي شيء.' : 'Ask us anything.'), 'proactive');
        }, clampDelay(config.behaviour.proactiveDelaySeconds));
      }
    }
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
