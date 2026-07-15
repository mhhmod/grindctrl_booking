/* GrindCTRL Try-On block: button styling comes from the GrindCTRL config
   API (dashboard-editable); clicking expands an iframe to the GrindCTRL
   embed inline. Height auto-syncs via postMessage from the embed. */
(function () {
  var EMBED_ORIGIN = 'https://grindctrl.cloud';

  function normalizeLocale(value) {
    return String(value || '').toLowerCase().split('-')[0] === 'ar' ? 'ar' : 'en';
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
        if (typeof cfg.radiusPx === 'number') btn.style.borderRadius = cfg.radiusPx + 'px';
        if (cfg.widgetTheme) root.dataset.theme = root.dataset.theme || cfg.widgetTheme;
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
        '&theme=' +
        encodeURIComponent(root.dataset.theme || '');

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
        if (event.data.type === 'grindctrl-tryon:add-to-cart') {
          var fail = function () {
            frame.contentWindow.postMessage(
              { type: 'grindctrl-tryon:cart-result', ok: false },
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
              if (res.ok) window.location.href = '/cart';
              else fail();
            })
            .catch(fail);
        }
      });

      root.appendChild(frame);
    });
  }

  var roots = document.querySelectorAll('.gc-tryon-root');
  for (var i = 0; i < roots.length; i++) mount(roots[i]);
})();
