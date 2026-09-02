/* GrindCTRL Try-On catalog embed: injects a "Try on" button on product
   cards (collection grids, featured products) and opens the try-on in a
   dialog. Same config, colors, and journey as the product-page block. */
(function () {
  var EMBED_ORIGIN = 'https://grindctrl.cloud';
  var script = document.currentScript;
  var SHOP = (script && script.dataset.gcShop) || '';
  var LOCALE =
    String((script && script.dataset.gcLocale) || '').toLowerCase().split('-')[0] === 'ar'
      ? 'ar'
      : 'en';
  var COPY = {
    en: {
      dialog: 'Try on',
      close: 'Close',
      loading: 'Loading try-on…',
      unavailable: 'Try-on could not be verified for this product.',
      retry: 'Retry try-on'
    },
    ar: {
      dialog: 'تجربة المنتج',
      close: 'إغلاق',
      loading: 'جارٍ تحميل تجربة المنتج…',
      unavailable: 'تعذّر التحقق من تجربة هذا المنتج.',
      retry: 'إعادة محاولة التجربة'
    }
  };
  var copy = COPY[LOCALE] || COPY.en;

  function createStorefrontNonce() {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return '';
    var bytes = new Uint8Array(18);
    window.crypto.getRandomValues(bytes);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function getStorefrontContext(product, nonce) {
    return fetch(
      '/apps/grindctrl/try-on-context?product=' +
        encodeURIComponent(product) +
        '&nonce=' +
        encodeURIComponent(nonce),
      { credentials: 'same-origin', headers: { Accept: 'application/json' } }
    ).then(function (res) {
      if (!res.ok) throw new Error('storefront_context_unavailable');
      return res.json();
    }).then(function (data) {
      if (!data || typeof data.token !== 'string' || data.nonce !== nonce) {
        throw new Error('invalid_storefront_context');
      }
      return data;
    });
  }

  var cfg = null;
  var cfgPromise = fetch('/apps/grindctrl/config?locale=' + LOCALE, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { cfg = data; applyConfigVars(data); return data; })
    .catch(function () { return null; });

  /* Sizing + surface come from the same settings as the product-page block. */
  function applyConfigVars(c) {
    if (!c) return;
    var root = document.documentElement;
    if (typeof c.catalogIconPx === 'number') root.style.setProperty('--gc-cat-icon', c.catalogIconPx + 'px');
    if (typeof c.catalogFontPx === 'number') root.style.setProperty('--gc-cat-font', c.catalogFontPx + 'px');
    if (typeof c.catalogPadPx === 'number') root.style.setProperty('--gc-cat-pad', c.catalogPadPx + 'px');
    var dark = c.widgetTheme === 'dark';
    root.style.setProperty('--gc-cat-surface', dark ? 'oklch(0.135 0.004 70)' : 'oklch(0.945 0.007 75)');
    root.style.setProperty('--gc-cat-ink', dark ? 'oklch(0.68 0.012 72)' : 'oklch(0.5 0.008 66)');
  }

  /* All styles injected by JS: theme card layouts stretch children and
     external stylesheets lose specificity wars; !important + fixed
     dimensions make the pill un-stretchable. */
  var STYLE_CSS =
    '.gc-cat-btn{position:absolute!important;inset-inline-end:8px!important;bottom:8px!important;' +
    'top:auto!important;inset-inline-start:auto!important;z-index:3!important;' +
    'display:inline-flex!important;align-items:center!important;gap:6px!important;' +
    'width:auto!important;height:auto!important;max-width:calc(100% - 16px)!important;' +
    'padding:var(--gc-cat-pad,6px) calc(var(--gc-cat-pad,6px) * 2)!important;'+
    'margin:0!important;border:0!important;border-radius:999px;' +
    'background:#2a2826;color:#f0ede9;font-size:var(--gc-cat-font,12px)!important;font-weight:600!important;' +
    'line-height:1!important;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.25);' +
    'transition:transform .2s cubic-bezier(.22,1,.36,1);min-height:0!important;min-width:0!important;' +
    'pointer-events:auto!important;z-index:2147482000!important;}' +
    '.gc-cat-btn:hover{transform:translateY(-1px) scale(1.03);}' +
    '.gc-cat-btn .gc-cat-btn-ic{display:inline-flex!important;width:var(--gc-cat-icon,14px)!important;height:var(--gc-cat-icon,14px)!important;flex:none!important;}' +
    '.gc-cat-btn .gc-cat-btn-ic svg{width:100%!important;height:100%!important;}' +
    '@keyframes gc-cat-scan{0%{transform:translateY(0);opacity:0}12%{opacity:1}58%{transform:translateY(17px);opacity:1}72%,100%{transform:translateY(17px);opacity:0}}' +
    '.gc-cat-scan{animation:gc-cat-scan 2.6s cubic-bezier(.4,0,.2,1) infinite;}' +
    '@media (prefers-reduced-motion:reduce){.gc-cat-scan{animation:none;opacity:1;transform:none;}}' +
    '.gc-cat-overlay{position:fixed!important;inset:0!important;z-index:2147483000!important;' +
    'display:none!important;align-items:center!important;justify-content:center!important;' +
    'padding:16px;background:rgba(20,18,16,.6);opacity:1!important;visibility:visible!important;}' +
    '.gc-cat-overlay--open{display:flex!important;}' +
    '.gc-cat-lock{overflow:hidden;}' +
    '.gc-cat-dialog{position:relative;width:100%;max-width:560px;min-height:180px;max-height:90dvh;overflow:hidden;' +
    'border-radius:16px;background:var(--gc-cat-surface,oklch(0.945 0.007 75));' +
    'box-shadow:0 24px 64px rgba(0,0,0,.35);}' +
    '.gc-cat-close{position:absolute;top:8px;inset-inline-end:8px;z-index:2;width:32px;height:32px;' +
    'border:0;border-radius:999px;background:rgba(42,40,38,.75);color:#f0ede9;font-size:20px;' +
    'line-height:1;cursor:pointer;}' +
    '.gc-cat-frame{display:block;width:100%;height:min(80dvh,720px);border:0;position:relative;z-index:1;}' +
    '@keyframes gc-cat-pulse{0%,100%{opacity:.35}50%{opacity:.6}}' +
    '.gc-cat-loading{position:absolute;inset:0;display:grid;place-items:center;z-index:0;' +
    'font:600 13px/1 system-ui,sans-serif;color:var(--gc-cat-ink,#8a8378);' +
    'animation:gc-cat-pulse 1.4s ease-in-out infinite;padding:32px;text-align:center;}' +
    '.gc-cat-retry{border:1px solid currentColor;border-radius:999px;background:transparent;' +
    'color:inherit;cursor:pointer;font:inherit;padding:7px 12px;margin-top:10px;}' +
    '.gc-cat-retry:focus-visible{outline:2px solid currentColor;outline-offset:2px;}';

  function injectStyles() {
    if (document.getElementById('gc-cat-styles')) return;
    var el = document.createElement('style');
    el.id = 'gc-cat-styles';
    el.textContent = STYLE_CSS;
    document.head.appendChild(el);
  }

  var ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">' +
    '<defs><clipPath id="gc-bust-cat"><circle cx="12" cy="6.6" r="3.2"/>' +
    '<path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z"/></clipPath></defs>' +
    '<g opacity="0.5"><circle cx="12" cy="6.6" r="3.2"/>' +
    '<path d="M4.6 21c0-4.5 3.3-7.2 7.4-7.2s7.4 2.7 7.4 7.2Z"/></g>' +
    '<g clip-path="url(#gc-bust-cat)"><rect class="gc-cat-scan" x="2" y="1" width="20" height="2.4" rx="1.2"/></g>' +
    '</svg>';

  function productHandleFromHref(href) {
    var m = String(href || '').match(/\/products\/([a-z0-9\-_]+)/i);
    return m ? m[1].toLowerCase() : '';
  }

  function normalizeImage(src) {
    if (!src) return '';
    if (src.indexOf('//') === 0) src = 'https:' + src;
    try {
      var u = new URL(src, window.location.href);
      if (u.hostname !== 'cdn.shopify.com' && !/\.myshopify\.com$/.test(u.hostname) && SHOP) {
        u.hostname = SHOP;
      }
      return u.toString();
    } catch (_) {
      return '';
    }
  }

  /* ── Dialog (one per page, reused) ── */
  var overlay = null;
  var frame = null;
  var currentHandle = '';
  var currentTitle = '';
  var currentGarment = '';

  function showDialogError(loading, handle, title, garment) {
    loading.style.display = 'grid';
    loading.style.animation = 'none';
    loading.setAttribute('role', 'alert');
    loading.setAttribute('aria-live', 'assertive');
    loading.textContent = '';
    var message = document.createElement('span');
    message.textContent = copy.unavailable;
    var retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'gc-cat-retry';
    retry.textContent = copy.retry;
    retry.addEventListener('click', function () {
      openDialog(handle, title, garment);
    });
    var content = document.createElement('div');
    content.appendChild(message);
    content.appendChild(document.createElement('br'));
    content.appendChild(retry);
    loading.appendChild(content);
  }

  function openDialog(handle, title, garment) {
    currentHandle = handle;
    currentTitle = title;
    currentGarment = garment;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'gc-cat-overlay';
      overlay.innerHTML =
        '<div class="gc-cat-dialog" role="dialog" aria-modal="true" aria-label="' + copy.dialog + '">' +
        '<button type="button" class="gc-cat-close" aria-label="' + copy.close + '">&times;</button>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target.classList.contains('gc-cat-close')) closeDialog();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeDialog();
      });
      window.addEventListener('message', onMessage);
    }

    var dialog = overlay.querySelector('.gc-cat-dialog');
    var loading = overlay.querySelector('.gc-cat-loading');
    if (!loading) {
      loading = document.createElement('div');
      loading.className = 'gc-cat-loading';
      loading.setAttribute('role', 'status');
      loading.setAttribute('aria-live', 'polite');
      loading.textContent = copy.loading;
      dialog.appendChild(loading);
    }
    loading.style.animation = '';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
    loading.textContent = copy.loading;
    loading.style.display = '';
    if (frame) frame.remove();
    overlay.classList.add('gc-cat-overlay--open');
    document.documentElement.classList.add('gc-cat-lock');
    var close = overlay.querySelector('.gc-cat-close');
    if (close) close.focus();

    var nonce = createStorefrontNonce();
    if (!nonce) {
      showDialogError(loading, handle, title, garment);
      return;
    }
    getStorefrontContext(handle, nonce).then(function (storefrontContext) {
      frame = document.createElement('iframe');
      frame.className = 'gc-cat-frame';
      frame.title = 'GrindCTRL Try-On';
      frame.src =
        EMBED_ORIGIN +
        '/embed/try-on?product=' + encodeURIComponent(handle) +
        '&title=' + encodeURIComponent(title || '') +
        '&garment=' + encodeURIComponent(garment || '') +
        '&shop=' + encodeURIComponent(SHOP) +
        '&locale=' + encodeURIComponent(LOCALE) +
        '#storefrontContext=' + encodeURIComponent(storefrontContext.token) +
        '&storefrontNonce=' + encodeURIComponent(nonce);
      frame.addEventListener('load', function () { loading.style.display = 'none'; });
      dialog.appendChild(frame);
      frame.addEventListener('error', function () {
        if (frame) { frame.remove(); frame = null; }
        showDialogError(loading, handle, title, garment);
      });
    }).catch(function () {
      showDialogError(loading, handle, title, garment);
    });
  }

  function closeDialog() {
    if (!overlay) return;
    overlay.classList.remove('gc-cat-overlay--open');
    document.documentElement.classList.remove('gc-cat-lock');
    if (frame) { frame.remove(); frame = null; }
  }

  function onMessage(event) {
    if (!frame || event.source !== frame.contentWindow || event.origin !== EMBED_ORIGIN) return;
    var data = event.data || {};
    if (data.type === 'grindctrl-tryon:refresh') {
      if (frame) { frame.remove(); frame = null; }
      openDialog(currentHandle, currentTitle, currentGarment);
      return;
    }
    if (data.type === 'grindctrl-tryon:add-to-cart') {
      var fail = function (message) {
        frame.contentWindow.postMessage(
          { type: 'grindctrl-tryon:cart-result', ok: false, message: message || '' },
          EMBED_ORIGIN
        );
      };
      // Cards don't carry a variant id; resolve it from the product JSON.
      fetch('/products/' + currentHandle + '.js', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (product) {
          var variant = product && (product.variants || []).filter(function (v) {
            return v.available;
          })[0];
          if (!variant) return fail();
          return fetch('/cart/add.js', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: [{ id: variant.id, quantity: 1 }] })
          }).then(function (res) {
            if (res.ok) { window.location.href = '/cart'; return; }
            return res.json().then(
              function (data) { fail(data && (data.description || data.message)); },
              function () { fail(); }
            );
          });
        })
        .catch(fail);
    }
  }

  /* ── Card discovery: any element containing a /products/ link + image ── */
  function findCards() {
    var seen = {};
    var anchors = document.querySelectorAll('a[href*="/products/"]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      if (a.closest('.gc-tryon-root, .gc-cat-overlay, nav, header, footer')) continue;
      var handle = productHandleFromHref(a.getAttribute('href'));
      if (!handle) continue;
      // The card is the nearest list item / grid cell containing an image.
      var card = a.closest('li, .grid__item, .card-wrapper, .product-card, [class*="product-item"]');
      if (!card) card = a.parentElement;
      if (!card || card.querySelector('.gc-cat-btn')) continue;
      var img = card.querySelector('img');
      if (!img) continue;
      // Skip the product page's own main content (the block handles it).
      if (card.closest('.product, product-info, [id^="MainProduct"]')) continue;
      var key = handle + '::' + (card.className || '');
      if (seen[key]) continue;
      seen[key] = true;
      injectButton(card, handle, img);
    }
  }

  function injectButton(card, handle, img) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gc-cat-btn';
    btn.setAttribute('data-gc-handle', handle);
    btn.setAttribute('data-gc-title', (img.getAttribute('alt') || handle.replace(/-/g, ' ')).trim());
    btn.innerHTML =
      '<span class="gc-cat-btn-ic">' + ICON_SVG + '</span><span class="gc-cat-btn-label">Try on</span>';

    cfgPromise.then(function (c) {
      if (c) {
        if (typeof c.catalogIconPx === 'number') {
          btn.style.setProperty('--gc-cat-icon', c.catalogIconPx + 'px');
        }
        if (typeof c.catalogFontPx === 'number') {
          btn.style.setProperty('--gc-cat-font', c.catalogFontPx + 'px');
        }
        if (typeof c.catalogPadPx === 'number') {
          btn.style.setProperty('--gc-cat-pad', c.catalogPadPx + 'px');
        }
        btn.style.background = c.accentBg || '';
        btn.style.color = c.accentFg || '';
        if (c.catalogLabel) {
          var lbl = btn.querySelector('.gc-cat-btn-label');
          if (lbl) lbl.textContent = c.catalogLabel;
        }
        if (typeof c.radiusPx === 'number') {
          btn.style.borderRadius = Math.min(c.radiusPx, 999) + 'px';
        }
      }
      // Outside the product <a>: theme capture/delegated link handlers
      // otherwise swallow the click before it reaches the pill.
      var link = img.closest('a');
      var host = (link && link.parentElement) || img.parentElement || card;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(btn);
    });
  }

  // One delegated capture-phase listener: fires before theme handlers and
  // survives themes cloning/re-rendering card DOM (which drops listeners).
  // Themes cover cards with invisible stretched-link overlays; the pill can
  // lose hit-testing even when visually on top. Resolve the pill by point.
  function pillFromEvent(e) {
    var t = e.target && e.target.closest && e.target.closest('.gc-cat-btn');
    if (t) return t;
    if (typeof document.elementsFromPoint === 'function' && typeof e.clientX === 'number') {
      var els = document.elementsFromPoint(e.clientX, e.clientY);
      for (var i = 0; i < els.length; i++) {
        if (els[i].closest) {
          var p = els[i].closest('.gc-cat-btn');
          if (p) return p;
        }
      }
    }
    return null;
  }

  document.addEventListener(
    'click',
    function (e) {
      var btn = pillFromEvent(e);
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      try {
        var handle = btn.getAttribute('data-gc-handle') || '';
        var title = btn.getAttribute('data-gc-title') || handle.replace(/-/g, ' ');
        var scope = btn.closest('li, .grid__item, .card-wrapper, .product-card, [class*="product-item"]') || btn.parentElement || document;
        var img = scope.querySelector('img');
        var garment = img ? normalizeImage(img.currentSrc || img.src) : '';
        if (handle) openDialog(handle, title, garment);
      } catch (err) {
        if (window.console && console.error) console.error('[GrindCTRL] try-on dialog failed', err);
      }
    },
    true
  );

  function init() {
    injectStyles();
    findCards();
    // Themes lazy-render grids (filtering, infinite scroll); re-scan calmly.
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(findCards, 400);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
