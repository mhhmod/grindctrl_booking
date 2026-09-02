/* GrindCTRL Try-On block: button styling comes from the GrindCTRL config
   API (dashboard-editable); clicking expands an iframe to the GrindCTRL
   embed inline. Height auto-syncs via postMessage from the embed. */
(function () {
  var EMBED_ORIGIN = 'https://grindctrl.cloud';

  function normalizeLocale(value) {
    return String(value || '').toLowerCase().split('-')[0] === 'ar' ? 'ar' : 'en';
  }

  var COPY = {
    en: {
      unavailable: 'Try-on could not be verified for this product.',
      retry: 'Retry try-on'
    },
    ar: {
      unavailable: 'تعذّر التحقق من تجربة هذا المنتج.',
      retry: 'إعادة محاولة التجربة'
    }
  };

  function clearProofError(root) {
    var existing = root.querySelector('.gc-tryon-error');
    if (existing) existing.remove();
  }

  function showProofError(root, btn, locale) {
    clearProofError(root);
    var copy = COPY[locale] || COPY.en;
    var status = document.createElement('div');
    status.className = 'gc-tryon-error';
    status.setAttribute('role', 'alert');
    status.setAttribute('aria-live', 'assertive');
    var message = document.createElement('span');
    message.textContent = copy.unavailable;
    var retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'gc-tryon-retry';
    retry.textContent = copy.retry;
    retry.addEventListener('click', function () {
      clearProofError(root);
      btn.click();
    });
    status.appendChild(message);
    status.appendChild(retry);
    root.appendChild(status);
  }

  function createStorefrontNonce() {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return '';
    var bytes = new Uint8Array(18);
    window.crypto.getRandomValues(bytes);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function getStorefrontContext(root, nonce) {
    var url =
      '/apps/grindctrl/try-on-context?product=' +
      encodeURIComponent(root.dataset.product || '') +
      '&nonce=' +
      encodeURIComponent(nonce);
    if (root.dataset.variant) url += '&variant=' + encodeURIComponent(root.dataset.variant);

    return fetch(url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('storefront_context_unavailable');
      return res.json();
    }).then(function (data) {
      if (!data || typeof data.token !== 'string' || data.nonce !== nonce) {
        throw new Error('invalid_storefront_context');
      }
      return data;
    });
  }

  function applyConfig(root, btn, locale) {
    fetch('/apps/grindctrl/config?locale=' + encodeURIComponent(locale), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cfg) {
        if (!cfg) return;
        if (root.dataset.labelSource !== 'theme' && cfg.buttonLabel) {
          var labelEl = btn.querySelector('.gc-tryon-label');
          if (labelEl) { labelEl.textContent = cfg.buttonLabel; }
          else { btn.textContent = cfg.buttonLabel; }
        }
        if (cfg.accentBg) btn.style.background = cfg.accentBg;
        if (cfg.accentFg) btn.style.color = cfg.accentFg;
        // Same ceiling as the catalog pill and the embed panel's control
        // radius, so one setting produces one shape everywhere.
        if (typeof cfg.radiusPx === 'number') {
          btn.style.borderRadius = Math.max(0, Math.min(cfg.radiusPx, 999)) + 'px';
        }
        if (typeof cfg.buttonIconPx === 'number') {
          btn.style.setProperty('--gc-ic-size', cfg.buttonIconPx + 'px');
        }
        if (cfg.iconBgFrom && cfg.iconBgTo) {
          btn.style.setProperty('--gc-ic-from', cfg.iconBgFrom);
          btn.style.setProperty('--gc-ic-to', cfg.iconBgTo);
        }
      })
      .catch(function () { /* defaults from CSS/schema stay */ })
      .then(function () {
        btn.classList.remove('gc-tryon-btn--loading');
        btn.removeAttribute('aria-busy');
      });
  }

  function mount(root) {
    var btn = root.querySelector('.gc-tryon-btn');
    if (!btn) return;

    var locale = normalizeLocale(root.dataset.locale);
    applyConfig(root, btn, locale);

    btn.addEventListener('click', function () {
      var existing = root.querySelector('iframe');
      if (existing) {
        existing.style.display = existing.style.display === 'none' ? '' : 'none';
        return;
      }

      clearProofError(root);

      var nonce = createStorefrontNonce();
      if (!nonce) {
        showProofError(root, btn, locale);
        return;
      }
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');

      getStorefrontContext(root, nonce).then(function (storefrontContext) {

      var garment = root.dataset.garment || '';
      if (garment.indexOf('//') === 0) garment = 'https:' + garment;
      // Custom-domain stores serve images from their own host; rewrite to
      // the permanent *.myshopify.com domain (same /cdn/ path) so the
      // embed's Shopify-only garment allowlist accepts it.
      try {
        var gu = new URL(garment);
        var host = gu.hostname;
        if (host !== 'cdn.shopify.com' && !/\.myshopify\.com$/.test(host) && root.dataset.shop) {
          gu.hostname = root.dataset.shop;
          garment = gu.toString();
        }
      } catch (_) { /* keep as-is; embed validates */ }

      var src =
        EMBED_ORIGIN +
        '/embed/try-on?product=' +
        encodeURIComponent(root.dataset.product || '') +
        '&title=' +
        encodeURIComponent(root.dataset.title || '') +
        '&garment=' +
        encodeURIComponent(garment) +
        '&shop=' +
        encodeURIComponent(root.dataset.shop || '') +
        '&locale=' +
        encodeURIComponent(locale) +
        '&variant=' +
        encodeURIComponent(root.dataset.variant || '') +
        '#storefrontContext=' +
        encodeURIComponent(storefrontContext.token) +
        '&storefrontNonce=' +
        encodeURIComponent(nonce);

      var frame = document.createElement('iframe');
      frame.src = src;
      frame.title = 'GrindCTRL Try-On';
      frame.className = 'gc-tryon-frame';

      var embedOrigin;
      try {
        embedOrigin = new URL(src, window.location.href).origin;
      } catch (_) {
        return;
      }

      window.addEventListener('message', function (event) {
        if (event.source !== frame.contentWindow || event.origin !== embedOrigin || !event.data) {
          return;
        }
        if (
          event.data.type === 'grindctrl-tryon:height' &&
          typeof event.data.height === 'number' &&
          Number.isFinite(event.data.height) &&
          event.data.height >= 200 &&
          event.data.height <= 5000
        ) {
          frame.style.height = event.data.height + 'px';
        }
        if (event.data.type === 'grindctrl-tryon:refresh') {
          frame.remove();
          clearProofError(root);
          btn.click();
          return;
        }
        if (event.data.type === 'grindctrl-tryon:add-to-cart') {
          var fail = function (message) {
            frame.contentWindow.postMessage(
              { type: 'grindctrl-tryon:cart-result', ok: false, message: message || '' },
              embedOrigin
            );
          };
          var variantId = parseInt(root.dataset.variant, 10);
          if (!variantId) return fail();
          fetch('/cart/add.js', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
          })
            .then(function (res) {
              if (res.ok) { window.location.href = '/cart'; return; }
              return res.json().then(
                function (data) { fail(data && (data.description || data.message)); },
                function () { fail(); }
              );
            })
            .catch(function () { fail(); });
        }
      });

      root.appendChild(frame);
      }).catch(function () {
        // Billing proof failed closed: do not open an iframe that could run
        // an unbound paid generation.
        showProofError(root, btn, locale);
      }).then(function () {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      });
    });
  }

  var roots = document.querySelectorAll('.gc-tryon-root');
  for (var i = 0; i < roots.length; i++) mount(roots[i]);
})();
