/**
 * GRINDCTRL Try-On hosted engine v1.2.0.
 *
 * One storefront lifecycle for every platform: the button and its ready
 * badge, the "Try on" pills on product cards, prewarm on view (skipped on
 * Save-Data and 2g), the loading skeleton, the iframe sheet, origin-checked
 * postMessage, the 24 hour on-phone look hint and locale. Platform
 * specifics live in a thin adapter (tryon-woo.js, tryon-paste.js):
 *
 *   detectProduct(button)          -> { id, variantId, ... } | null   read at every tap
 *   getContext(product)            -> Promise<{ embedUrl, context: { expiresAt }, settings? }>
 *                                     (error.hidden = true removes the button; on a card
 *                                     pill, every pill unless error.scope is 'product')
 *   getProduct(product)            -> Promise<{ options, variants, currency } | null>  for the sheet's size picker
 *   addToCart(variant, qty, state) -> Promise<{ ok, message?, variantTitle? } | 'unsupported'>
 *   placementTarget()              -> Element the injected button follows (injectButton adapters only)
 *   findCards(rescan)              -> [{ host, productId, title }] cards to give a pill (injectCards adapters only);
 *                                     cardSettings carries the catalog label, sizes and colors
 *   lookKey(button), messageProductId(product), checkout(), locale, embedOrigin?, buttonLabel?, cardLabel?
 *
 * Platform data is display and cart data only; the signed context is the
 * authority for a look. Fails quiet: nothing here may break the store page.
 */
(function () {
  'use strict';
  if (window.GRINDCTRL_TRYON_ENGINE) return;
  window.GRINDCTRL_TRYON_ENGINE = { version: '1.2.0', mount: function (adapter) {
  var BUTTON = '.gc-tryon-btn[data-product-id]';
  var PILL = '.gc-tryon-pill[data-product-id]';
  // Pills one page may hold; the observer stops once there are this many.
  var MAX_PILLS = 200;
  // A plugin-printed button belongs to its plugin's mount; an injected one,
  // or a card pill, to its own.
  var injected = null;
  function isPill(button) { return button.hasAttribute('data-gc-card'); }
  function owns(button) {
    if (isPill(button)) return !!adapter.injectCards;
    if (adapter.injectCards) return false;
    return adapter.injectButton ? button === injected : !button.hasAttribute('data-gc-paste');
  }
  var locale = String(adapter.locale || document.documentElement.lang || '').toLowerCase().split(/[-_]/)[0] === 'ar' ? 'ar' : 'en';
  var COPY = {
    en: {
      close: 'Close',
      unavailable: 'Try-on could not be started. Please try again.',
      retry: 'Try again',
      addFailed: 'This item could not be added to the cart.',
      chooseOnPage: 'Choose a size above, then add it to the cart.',
      loading: 'Opening try-on',
      ready: 'Your look is ready',
      readyShort: 'Ready',
      seeLook: 'See your look'
    },
    ar: {
      close: 'إغلاق',
      unavailable: 'تعذّر بدء التجربة. حاول مرة أخرى.',
      retry: 'إعادة المحاولة',
      addFailed: 'تعذّرت إضافة هذا المنتج إلى السلة.',
      chooseOnPage: 'اختر المقاس أعلاه ثم أضفه إلى السلة.',
      loading: 'جارٍ فتح التجربة',
      ready: 'إطلالتك جاهزة',
      readyShort: 'جاهزة',
      seeLook: 'شاهد إطلالتك'
    }
  };
  var t = COPY[locale];

  // No image or personal data crosses to the store. Only the local look's state.
  var LOOK_HINTS_KEY = 'gc_tryon_look_hints_v1';
  function lookHints() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(LOOK_HINTS_KEY) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter(function (hint) {
        return hint && typeof hint.key === 'string' && hint.key.length <= 512 &&
          Number.isFinite(hint.expiresAt) && hint.expiresAt > Date.now() && hint.expiresAt <= Date.now() + 86400000;
      }).slice(0, 5);
    } catch (_) { return []; }
  }
  function lookIndicator(btn, copy, key) {
    var label = btn.querySelector('.gc-tryon-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'gc-tryon-label';
      while (btn.firstChild) label.appendChild(btn.firstChild);
      btn.appendChild(label);
    }
    var original = '';
    var badge = document.createElement('span');
    badge.className = 'gc-tryon-ready';
    badge.hidden = true;
    var live = document.createElement('span');
    live.className = 'gc-tryon-live';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    btn.appendChild(badge);
    btn.parentNode.appendChild(live);
    return {
      hydrate: function () {
        if (!lookHints().some(function (hint) { return hint.key === key; })) return;
        original = label.textContent;
        label.textContent = copy.seeLook;
      },
      update: function (state, open, expiresAt, all) {
        var hints = lookHints().filter(function (hint) { return hint.key !== key; });
        if ((state === 'ready' || state === 'stored') && Number.isFinite(expiresAt) &&
            expiresAt > Date.now() && expiresAt <= Date.now() + 86400000) {
          hints.unshift({ key: key, expiresAt: expiresAt });
        }
        if (state === 'cleared' || state === 'ready' || state === 'stored') {
          try {
            if (state === 'cleared' && all === true) window.localStorage.removeItem(LOOK_HINTS_KEY);
            else window.localStorage.setItem(LOOK_HINTS_KEY, JSON.stringify(hints.slice(0, 5)));
          } catch (_) {}
        }
        if (state === 'cleared') {
          if (original) label.textContent = original;
          original = '';
          badge.hidden = true;
          live.textContent = '';
          return;
        }
        if (state !== 'ready' && state !== 'stored') return;
        if (!original) original = label.textContent;
        label.textContent = copy.seeLook;
        badge.hidden = state !== 'ready' || open;
        badge.textContent = copy.readyShort;
        live.textContent = badge.hidden ? '' : copy.ready;
      },
      seen: function () { badge.hidden = true; live.textContent = ''; },
      relabel: function (text) { if (original) original = text; else label.textContent = text; }
    };
  }

  /* The owner's label and colors from the context settings, through the
     same custom properties the WooCommerce plugin prints on its button. */
  function applySettings(button, settings, indicator) {
    if (!settings || button.dataset.gcStyled === '1') return;
    button.dataset.gcStyled = '1';
    var label = typeof settings.buttonLabel === 'string' ? settings.buttonLabel.trim() : '';
    if (label && label.length <= 80) indicator.relabel(label);
    var supports = window.CSS && typeof window.CSS.supports === 'function';
    if (supports && typeof settings.accentBg === 'string' && window.CSS.supports('color', settings.accentBg)) button.style.setProperty('--gc-bg', settings.accentBg);
    if (supports && typeof settings.accentFg === 'string' && window.CSS.supports('color', settings.accentFg)) button.style.setProperty('--gc-fg', settings.accentFg);
    var radius = Number(settings.radiusPx);
    // Same rule as lib/try-on/appearance.ts and the pill below: the owner's exact
    // corners, 999 = fully round. (A 0-48 range used to turn the round default into 10px.)
    if (Number.isFinite(radius) && radius >= 0) button.style.setProperty('--gc-radius', Math.min(Math.round(radius), 999) + 'px');
  }

  var prewarmed = false;
  function observeForPrewarm(element, prepare) {
    var connection = navigator.connection;
    if (prewarmed || !window.IntersectionObserver ||
        (connection && (connection.saveData || /^(slow-)?2g$/.test(connection.effectiveType)))) return;
    var observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      observer.disconnect();
      if (prewarmed) return;
      var activeConnection = navigator.connection;
      if (activeConnection && (activeConnection.saveData || /^(slow-)?2g$/.test(activeConnection.effectiveType))) return;
      prewarmed = true;
      prepare();
    });
    observer.observe(element);
  }

  /* ── Styles ─────────────────────────────────────────────────────────── */

  function injectStyles() {
    if (document.getElementById('gc-tryon-woo-css')) return;
    var style = document.createElement('style');
    style.id = 'gc-tryon-woo-css';
    style.textContent = [
      '.gc-tryon-btn{--gc-bg:#1f1d1a;--gc-fg:#f6f1e7;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;',
      'min-block-size:44px;min-inline-size:44px;padding-block:.65rem;padding-inline:1.25rem;margin-block:.5rem;border:0;',
      'border-radius:var(--gc-radius,999px);background:var(--gc-bg);color:var(--gc-fg);font:inherit;font-weight:600;',
      'line-height:1.2;cursor:pointer;text-decoration:none}',
      '.gc-tryon-btn:focus-visible{outline:3px solid currentColor;outline-offset:3px}',
      '.gc-tryon-btn[disabled]{opacity:.6;cursor:progress}',
      '.gc-tryon-btn--card{margin-block:.25rem;padding-block:.45rem;padding-inline:.9rem;font-size:.875rem}',
      '.gc-tryon-btn--preview{display:none}',
      '.gc-tryon-btn{flex-wrap:wrap}',
      '.gc-tryon-ready{font-size:.75em;padding:.2em .5em;border:1px solid currentColor;border-radius:999px}',
      '.gc-tryon-ready[hidden],.gc-tryon-loading[hidden]{display:none}',
      '.gc-tryon-live{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
      '.gc-tryon-loading{position:absolute;inset-block:44px 0;inset-inline:0;z-index:1;display:grid;place-content:center;gap:1rem;background:inherit;color:inherit;font:inherit}',
      '.gc-tryon-loading::before{content:"";display:block;inline-size:min(15rem,65vw);block-size:12rem;border-radius:1rem;background:currentColor;opacity:.08}',
      '.gc-tryon-note{margin-block:.25rem;font-size:.875rem;line-height:1.4}',
      '.gc-tryon-note button{margin-inline-start:.5rem;min-block-size:44px;padding-inline:.75rem;font:inherit;cursor:pointer}',
      '.gc-tryon-sheet{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center}',
      '.gc-tryon-sheet[hidden]{display:none}',
      '.gc-tryon-sheet__backdrop{position:absolute;inset:0;background:rgba(20,18,15,.55);opacity:0;transition:opacity .2s}',
      '.gc-tryon-sheet__panel{position:relative;display:flex;flex-direction:column;inline-size:100%;block-size:min(92dvh,780px);',
      'background:#fff;color:#1f1d1a;border-start-start-radius:20px;border-start-end-radius:20px;overflow:hidden;',
      'transform:translateY(100%);transition:transform .25s ease}',
      '.gc-tryon-sheet--open .gc-tryon-sheet__backdrop{opacity:1}',
      '.gc-tryon-sheet--open .gc-tryon-sheet__panel{transform:none}',
      '.gc-tryon-sheet__bar{display:flex;align-items:center;justify-content:space-between;min-block-size:44px;padding-inline:.5rem;touch-action:none}',
      '.gc-tryon-sheet__handle{inline-size:40px;block-size:4px;margin-inline:auto;border-radius:2px;background:rgba(0,0,0,.25)}',
      '.gc-tryon-sheet__close{position:absolute;inset-block-start:0;inset-inline-end:0;display:inline-flex;align-items:center;justify-content:center;',
      'inline-size:44px;block-size:44px;border:0;background:transparent;color:inherit;cursor:pointer}',
      '.gc-tryon-sheet__close svg{inline-size:20px;block-size:20px}',
      '.gc-tryon-sheet__close:focus-visible{outline:3px solid currentColor;outline-offset:-3px}',
      '.gc-tryon-frame{flex:1 1 auto;inline-size:100%;min-block-size:0;border:0;background:transparent}',
      '@media (min-width:640px){.gc-tryon-sheet{align-items:center}',
      '.gc-tryon-sheet__panel{inline-size:min(520px,calc(100vw - 2rem));border-radius:20px;transform:translateY(24px);opacity:0;',
      'transition:transform .25s ease,opacity .2s}',
      '.gc-tryon-sheet--open .gc-tryon-sheet__panel{opacity:1}}',
      '@media (prefers-reduced-motion:reduce){.gc-tryon-sheet__backdrop,.gc-tryon-sheet__panel{transition:none}}',
      /* The card pill: the Shopify app's catalog pill (tryon-catalog.js), the
         same sizes, colors and placement. !important and fixed dimensions
         because theme card layouts stretch children. */
      '.gc-tryon-pill{position:absolute!important;inset-inline-end:8px!important;inset-block-end:8px!important;',
      'inset-block-start:auto!important;inset-inline-start:auto!important;z-index:2147482000!important;',
      'display:inline-flex!important;align-items:center!important;gap:6px!important;width:auto!important;height:auto!important;',
      'max-width:calc(100% - 16px)!important;min-width:0!important;min-height:24px!important;',
      'padding:var(--gc-pill-pad,6px) calc(var(--gc-pill-pad,6px) * 2)!important;margin:0!important;border:0!important;',
      'border-radius:var(--gc-pill-radius,999px)!important;background:var(--gc-pill-bg,#2a2826)!important;color:var(--gc-pill-fg,#f0ede9)!important;',
      'font-family:inherit;font-size:var(--gc-pill-font,12px)!important;font-weight:600!important;line-height:1!important;',
      'letter-spacing:normal;text-transform:none;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25);',
      'transition:transform .2s cubic-bezier(.22,1,.36,1);pointer-events:auto!important}',
      '.gc-tryon-pill:hover{transform:translateY(-1px) scale(1.03)}',
      '.gc-tryon-pill:focus-visible{outline:2px solid #fff;outline-offset:0;box-shadow:0 0 0 4px #1f1d1a}',
      '.gc-tryon-pill[disabled]{opacity:.7;cursor:progress}',
      '.gc-tryon-pill__icon{display:inline-flex!important;width:var(--gc-pill-icon,14px)!important;height:var(--gc-pill-icon,14px)!important;flex:none!important}',
      '.gc-tryon-pill__icon svg{width:100%!important;height:100%!important}',
      '.gc-tryon-pill .gc-tryon-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.gc-tryon-sr{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
      '@keyframes gc-tryon-scan{0%{transform:translateY(0);opacity:0}12%{opacity:1}58%{transform:translateY(17px);opacity:1}72%,100%{transform:translateY(17px);opacity:0}}',
      '.gc-tryon-scan{animation:gc-tryon-scan 2.6s cubic-bezier(.4,0,.2,1) infinite}',
      '.gc-tryon-note--pill{position:absolute;inset-inline:8px;inset-block-end:calc(16px + 2em);z-index:2147482001;margin:0;',
      'padding:.5rem .75rem;border-radius:12px;background:#fff;color:#1f1d1a;box-shadow:0 4px 16px rgba(0,0,0,.2);font-size:13px}',
      '@media (prefers-reduced-motion:reduce){.gc-tryon-scan{animation:none;opacity:1;transform:none}',
      '.gc-tryon-pill{transition:none}.gc-tryon-pill:hover{transform:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  /* ── Notes next to the button ───────────────────────────────────────── */

  function clearNote(button) {
    var next = button.nextElementSibling;
    if (next && next.classList.contains('gc-tryon-note')) next.remove();
  }

  function showNote(button, message, retry) {
    clearNote(button);
    var note = document.createElement('div');
    // Over the card image, beside its pill, rather than inside the theme's layout.
    note.className = isPill(button) ? 'gc-tryon-note gc-tryon-note--pill' : 'gc-tryon-note';
    note.setAttribute('role', 'alert');
    var text = document.createElement('span');
    text.textContent = message;
    note.appendChild(text);
    if (retry) {
      var again = document.createElement('button');
      again.type = 'button';
      again.textContent = t.retry;
      again.addEventListener('click', function () { clearNote(button); button.click(); });
      note.appendChild(again);
    }
    button.insertAdjacentElement('afterend', note);
  }

  /* ── The sheet ──────────────────────────────────────────────────────── */

  function createSheet(button, frame) {
    var sheet = document.createElement('div');
    sheet.className = 'gc-tryon-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', button.textContent.trim() || 'Try-On');
    sheet.dir = locale === 'ar' ? 'rtl' : 'ltr';
    sheet.hidden = true;

    var backdrop = document.createElement('div');
    backdrop.className = 'gc-tryon-sheet__backdrop';
    var panel = document.createElement('div');
    panel.className = 'gc-tryon-sheet__panel';
    var bar = document.createElement('div');
    bar.className = 'gc-tryon-sheet__bar';
    var handle = document.createElement('span');
    handle.className = 'gc-tryon-sheet__handle';
    handle.setAttribute('aria-hidden', 'true');
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'gc-tryon-sheet__close';
    close.setAttribute('aria-label', t.close);
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
    bar.appendChild(handle);
    bar.appendChild(close);
    panel.appendChild(bar);
    var loading = document.createElement('div');
    loading.className = 'gc-tryon-loading';
    loading.setAttribute('role', 'status');
    loading.textContent = t.loading;
    panel.appendChild(loading);
    panel.appendChild(frame);
    frame.addEventListener('load', function () {
      if (!frame.getAttribute('src')) return;
      loading.hidden = true;
      if (frame.contentWindow) frame.contentWindow.postMessage({ type: 'grindctrl-tryon:visibility', open: open }, new URL(frame.src).origin);
    });
    sheet.appendChild(backdrop);
    sheet.appendChild(panel);
    document.body.appendChild(sheet);

    var open = false;
    var pushed = false;
    var inerted = [];
    var previousOverflow = '';

    function onKey(event) {
      if (event.key === 'Escape') hide(false);
    }

    function show() {
      if (open) return;
      open = true;
      sheet.hidden = false;
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      for (var i = 0; i < document.body.children.length; i++) {
        var child = document.body.children[i];
        if (child !== sheet && !child.inert) { child.inert = true; inerted.push(child); }
      }
      // The phone's back gesture closes the sheet, not the product page.
      try { window.history.pushState({ gcTryOnSheet: true }, ''); pushed = true; } catch (_) { pushed = false; }
      document.addEventListener('keydown', onKey);
      window.requestAnimationFrame(function () { sheet.classList.add('gc-tryon-sheet--open'); });
      frame.focus();
      if (frame.isConnected && frame.getAttribute('src') && frame.contentWindow) frame.contentWindow.postMessage({ type: 'grindctrl-tryon:visibility', open: true }, new URL(frame.src).origin);
    }

    function hide(fromHistory) {
      if (!open) return;
      open = false;
      sheet.classList.remove('gc-tryon-sheet--open');
      sheet.hidden = true;
      panel.style.transform = '';
      document.documentElement.style.overflow = previousOverflow;
      while (inerted.length) inerted.pop().inert = false;
      document.removeEventListener('keydown', onKey);
      if (pushed) {
        pushed = false;
        if (!fromHistory) { try { window.history.back(); } catch (_) { /* nothing to undo */ } }
      }
      button.focus();
      if (frame.isConnected && frame.getAttribute('src') && frame.contentWindow) frame.contentWindow.postMessage({ type: 'grindctrl-tryon:visibility', open: false }, new URL(frame.src).origin);
    }

    window.addEventListener('popstate', function () { if (open && pushed) hide(true); });
    close.addEventListener('click', function () { hide(false); });
    backdrop.addEventListener('click', function () { hide(false); });

    // A swipe down on the handle bar closes it; a short one springs back.
    var startY = null;
    bar.addEventListener('pointerdown', function (event) {
      if (event.target === close || close.contains(event.target)) return;
      startY = event.clientY;
      if (bar.setPointerCapture) bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener('pointermove', function (event) {
      if (startY !== null) panel.style.transform = 'translateY(' + Math.max(0, event.clientY - startY) + 'px)';
    });
    function endSwipe(event) {
      if (startY === null) return;
      var travelled = event.clientY - startY;
      startY = null;
      if (travelled > 80) hide(false); else panel.style.transform = '';
    }
    bar.addEventListener('pointerup', endSwipe);
    bar.addEventListener('pointercancel', endSwipe);

    return {
      open: show,
      close: function () { hide(false); },
      isOpen: function () { return open; },
      destroy: function () { hide(false); if (sheet.parentNode) sheet.parentNode.removeChild(sheet); }
    };
  }

  /* ── Click flow ─────────────────────────────────────────────────────── */

  // Same store-local preview token as the Shopify loader and Store Chat.
  // GRINDCTRL verifies its signature, tenant and expiry before signing test:true.
  function previewToken() {
    var token = '';
    try { token = new URLSearchParams(window.location.search).get('gc_preview') || ''; } catch (_) {}
    if (/^[A-Za-z0-9_.-]{20,512}$/.test(token)) {
      try { window.localStorage.setItem('gc_preview', JSON.stringify({ token: token, savedAt: Date.now() })); } catch (_) {}
      return token;
    }
    try {
      var saved = JSON.parse(window.localStorage.getItem('gc_preview') || 'null');
      if (saved && /^[A-Za-z0-9_.-]{20,512}$/.test(saved.token) && typeof saved.savedAt === 'number' &&
          Date.now() >= saved.savedAt && Date.now() - saved.savedAt < 24 * 60 * 60 * 1000) return saved.token;
    } catch (_) {}
    return '';
  }

  var sessions = new WeakMap();
  var indicators = new WeakMap();
  function indicatorFor(button) {
    var indicator = indicators.get(button);
    if (!indicator) { indicator = lookIndicator(button, t, adapter.lookKey(button)); indicators.set(button, indicator); indicator.hydrate(); }
    return indicator;
  }

  function embedOriginOf(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === 'https:' && !parsed.username ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function openTryOn(button, warm) {
    var openedAt = warm ? 0 : Date.now();
    var existing = sessions.get(button);
    var product = adapter.detectProduct(button);
    if (!product) return;
    var picked = { id: product.variantId || 0 };
    // A prewarmed context is short lived and made for one variant. Never replace a look already opened.
    if (existing && !existing.opened && (Date.now() >= existing.expiresAt || existing.variationId !== picked.id)) {
      existing.sheet.destroy();
      if (existing.dispose) existing.dispose();
      sessions.delete(button);
      existing = null;
    }
    // Reopening resumes whatever the sheet held, a look included.
    if (existing) {
      if (!warm) { existing.opened = true; indicatorFor(button).seen(); existing.sheet.open(); }
      return;
    }

    var productId = product.id;
    if (!productId) return;
    // A variable product opens without a choice, as on Shopify: the look uses
    // the product image and the sheet's size picker chooses before add to cart.
    clearNote(button);
    if (!warm) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    var indicator = indicatorFor(button);
    var frame = document.createElement('iframe');
    frame.className = 'gc-tryon-frame';
    frame.title = 'GRINDCTRL Try-On';
    frame.setAttribute('allow', 'camera; clipboard-write');
    var sheet = createSheet(button, frame);
    var session = { sheet: sheet, frame: frame, opened: !warm, expiresAt: Date.now() + 90000, variationId: picked.id };
    sessions.set(button, session);
    if (!warm) { indicator.seen(); sheet.open(); }

    adapter.getContext(product).then(function (data) {
      if (sessions.get(button) !== session) return;
      var target = embedOriginOf(data.embedUrl);
      if (!target || (adapter.embedOrigin && target.origin !== adapter.embedOrigin)) throw new Error('context_invalid');
      if (openedAt) target.searchParams.set('gc_opened_at', String(openedAt));
      var expiry = Date.parse(data.context && data.context.expiresAt);
      if (Number.isFinite(expiry)) session.expiresAt = expiry - 5000;
      if (adapter.injectButton) applySettings(button, data.settings, indicator);
      frame.src = target.href;
      var storeProduct = null;

      function reply(message) {
        if (frame.contentWindow) frame.contentWindow.postMessage(message, target.origin);
      }

      function onMessage(event) {
        if (event.source !== frame.contentWindow || event.origin !== target.origin || !event.data) return;
        if (sessions.get(button) !== session) return;
        var type = event.data.type;
        if (type === 'grindctrl-tryon:look') {
          if (String(event.data.productId) === adapter.messageProductId(product)) indicator.update(event.data.state, sheet.isOpen(), event.data.expiresAt, event.data.all);
          return;
        }
        if (type === 'grindctrl-tryon:close') { sheet.close(); return; }
        if (type === 'grindctrl-tryon:checkout') { adapter.checkout(); return; }
        if (type === 'grindctrl-tryon:back-to-product') { sheet.close(); return; }
        if (type === 'grindctrl-tryon:refresh') {
          sheet.destroy();
          if (session.dispose) session.dispose();
          sessions.delete(button);
          button.click();
          return;
        }
        if (type === 'grindctrl-tryon:product-request') {
          adapter.getProduct(product).then(function (listed) {
            if (!listed || !Array.isArray(listed.variants) || !listed.variants.length) return;
            storeProduct = listed;
            reply({ type: 'grindctrl-tryon:product', product: listed, variant: picked.id });
          });
          return;
        }
        if (type === 'grindctrl-tryon:add-to-cart') {
          adapter.addToCart(String(event.data.variantId || picked.id || productId), 1, {
            product: product, storeProduct: storeProduct, button: button, copy: t
          }).then(function (result) {
            reply(Object.assign({ type: 'grindctrl-tryon:cart-result' }, result === 'unsupported' ? { ok: false } : result));
          }).catch(function () {
            reply({ type: 'grindctrl-tryon:cart-result', ok: false, message: t.addFailed });
          });
        }
      }
      window.addEventListener('message', onMessage);
      session.dispose = function () { window.removeEventListener('message', onMessage); };

    }).catch(function (error) {
      if (sessions.get(button) !== session) return;
      sheet.destroy();
      sessions.delete(button);
      if (error && error.hidden) {
        // The looks ran out after this page loaded: take the button away
        // rather than show an error the shopper cannot act on. On a card,
        // every pill goes unless only this product cannot start a look.
        clearNote(button);
        if (isPill(button) && error.scope !== 'product') { stopPills(); return; }
        button.remove();
        return;
      }
      if (!warm || session.opened) showNote(button, t.unavailable, true);
    }).then(function () {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    });
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest(BUTTON) : null;
    if (!button || !owns(button)) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    try { openTryOn(button, false); } catch (_) { showNote(button, t.unavailable, true); }
  });

  /* ── Card pills ─────────────────────────────────────────────────────── */

  var PILL_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true" focusable="false">' +
    '<defs><clipPath id="gc-tryon-bust"><circle cx="12" cy="6.6" r="3.2"/>' +
    '<path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z"/></clipPath></defs>' +
    '<g opacity="0.5"><circle cx="12" cy="6.6" r="3.2"/><path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z"/></g>' +
    '<g clip-path="url(#gc-tryon-bust)"><rect class="gc-tryon-scan" x="2" y="1" width="20" height="2.4" rx="1.2"/></g></svg>';
  var pillsStopped = false;
  var pillObserver = null;

  // The store cannot start looks any more: take every pill away.
  function stopPills() {
    pillsStopped = true;
    if (pillObserver) pillObserver.disconnect();
    document.querySelectorAll(PILL).forEach(function (pill) { clearNote(pill); pill.remove(); });
  }

  /* The owner's catalog label, sizes, colors and radius: the same settings
     and limits as the Shopify app's catalog pill and the dashboard. */
  function pillLook(settings) {
    var s = settings || {};
    var vars = {};
    function px(value, min, max, name) {
      var n = Number(value);
      if (value !== null && value !== '' && Number.isFinite(n) && n >= min && n <= max) vars[name] = Math.round(n) + 'px';
    }
    px(s.catalogIconPx, 10, 32, '--gc-pill-icon');
    px(s.catalogFontPx, 9, 20, '--gc-pill-font');
    px(s.catalogPadPx, 2, 16, '--gc-pill-pad');
    px(s.radiusPx, 0, 999, '--gc-pill-radius');
    var supports = window.CSS && typeof window.CSS.supports === 'function';
    if (supports && typeof s.accentBg === 'string' && window.CSS.supports('color', s.accentBg)) vars['--gc-pill-bg'] = s.accentBg;
    if (supports && typeof s.accentFg === 'string' && window.CSS.supports('color', s.accentFg)) vars['--gc-pill-fg'] = s.accentFg;
    var label = typeof s.catalogLabel === 'string' ? s.catalogLabel.trim() : '';
    return { vars: vars, label: label && label.length <= 60 ? label : (adapter.cardLabel || 'Try on') };
  }

  function addPill(card, look) {
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'gc-tryon-pill';
    pill.dataset.productId = card.productId;
    pill.dataset.gcPaste = '1';
    pill.dataset.gcCard = '1';
    var icon = document.createElement('span');
    icon.className = 'gc-tryon-pill__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = PILL_ICON;
    var label = document.createElement('span');
    label.className = 'gc-tryon-label';
    label.textContent = look.label;
    pill.appendChild(icon);
    pill.appendChild(label);
    // Every pill in a grid says the same: its name says which product.
    if (card.title) {
      var name = document.createElement('span');
      name.className = 'gc-tryon-sr';
      name.textContent = ' ' + card.title;
      pill.appendChild(name);
    }
    Object.keys(look.vars).forEach(function (key) { pill.style.setProperty(key, look.vars[key]); });
    var position = window.getComputedStyle(card.host).position;
    if (!position || position === 'static') card.host.style.position = 'relative';
    card.host.appendChild(pill);
    indicatorFor(pill);
  }

  function mountPills() {
    // A store that also runs the Shopify app's catalog embed keeps its pills.
    if (document.getElementById('gc-cat-styles') || document.querySelector('.gc-cat-btn')) return;
    var look = pillLook(adapter.cardSettings);
    var count = 0;
    var timer = null;
    function scan() {
      timer = null;
      if (pillsStopped) return;
      var cards = adapter.findCards(schedule);
      for (var i = 0; i < cards.length && count < MAX_PILLS; i++) {
        try { addPill(cards[i], look); count++; } catch (_) { /* one odd card must not stop the rest */ }
      }
      if (count >= MAX_PILLS && pillObserver) pillObserver.disconnect();
    }
    function schedule() { if (!pillsStopped && !timer) timer = setTimeout(scan, 300); }
    scan();
    if (!window.MutationObserver || count >= MAX_PILLS) return;
    // Cards added later (infinite scroll, filters, quick views): look again,
    // at most every 300 ms, and only when new markup brings a product link.
    pillObserver = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType === 1 && !node.closest('.gc-tryon-sheet') &&
              (node.matches('a[href*="/products/"]') || node.querySelector('a[href*="/products/"]'))) { schedule(); return; }
        }
      }
    });
    pillObserver.observe(document.body, { childList: true, subtree: true });
  }

  /* Themes cover cards with stretched-link overlays, so a tap on a pill can
     land on the overlay. Resolve the pill by point in the capture phase,
     before theme handlers, but never through a fixed or sticky layer above
     it (the chat bubble, a sticky cart bar, the sheet itself). */
  function pillFromEvent(event) {
    var target = event.target;
    var pill = target && target.closest ? target.closest(PILL) : null;
    if (pill) return pill;
    if (typeof document.elementsFromPoint !== 'function' || typeof event.clientX !== 'number' || (!event.clientX && !event.clientY)) return null;
    var stack = document.elementsFromPoint(event.clientX, event.clientY);
    for (var i = 0; i < stack.length; i++) {
      if (!stack[i].closest) continue;
      var found = stack[i].closest(PILL);
      if (found) return found;
      var position = window.getComputedStyle(stack[i]).position;
      if (position === 'fixed' || position === 'sticky') return null;
    }
    return null;
  }

  if (adapter.injectCards) {
    document.addEventListener('click', function (event) {
      var pill = pillFromEvent(event);
      if (!pill || !owns(pill)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (pill.disabled) return;
      try { openTryOn(pill, false); } catch (_) { showNote(pill, t.unavailable, true); }
    }, true);
  }

  injectStyles();
  if (adapter.injectCards) mountPills();
  if (adapter.injectButton) {
    // A store that also runs the Shopify app block or the Woo plugin keeps that one button.
    if (document.querySelector('.gc-tryon-btn, .gc-tryon-root')) return;
    var placement = adapter.placementTarget();
    var detected = adapter.detectProduct();
    if (!placement || !placement.parentNode || !detected) return;
    injected = document.createElement('button');
    injected.type = 'button';
    injected.className = 'gc-tryon-btn';
    injected.dataset.productId = detected.id;
    injected.dataset.gcPaste = '1';
    injected.textContent = adapter.buttonLabel;
    placement.insertAdjacentElement('afterend', injected);
  }
  // An exhausted store stays hidden to shoppers. Only a preview token reveals
  // its test entry; the context route is still the authority for test looks.
  if (!adapter.injectButton && previewToken()) {
    document.querySelectorAll('.gc-tryon-btn--preview').forEach(function (button) {
      button.classList.remove('gc-tryon-btn--preview');
      button.style.removeProperty('display');
    });
  }
  document.querySelectorAll(BUTTON).forEach(function (button) {
    if (!owns(button)) return;
    indicatorFor(button);
    if (!button.classList.contains('gc-tryon-btn--preview')) {
      observeForPrewarm(button, function () { openTryOn(button, true); });
    }
  });
  } };
})();
