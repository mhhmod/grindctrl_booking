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

  var cfg = null;
  var cfgPromise = fetch('/apps/grindctrl/config?locale=' + LOCALE, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { cfg = data; return data; })
    .catch(function () { return null; });

  var ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="4.6" r="2.1"/>' +
    '<path d="M8.2 9.3 6.2 12l1.9 1.5.6-.8V17h6.6v-4.3l.6.8L17.8 12l-2-2.7c-1.2-.6-2.4-.9-3.8-.9s-2.6.3-3.8.9Z"/>' +
    '<path d="m19.6 3.4.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5Z" fill="currentColor" stroke="none"/>' +
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

  function openDialog(handle, title, garment) {
    currentHandle = handle;
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'gc-cat-overlay';
      overlay.innerHTML =
        '<div class="gc-cat-dialog" role="dialog" aria-modal="true" aria-label="Try on">' +
        '<button type="button" class="gc-cat-close" aria-label="Close">&times;</button>' +
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
    if (frame) frame.remove();
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
      '&theme=' + encodeURIComponent((cfg && cfg.widgetTheme) || '');
    dialog.appendChild(frame);
    overlay.classList.add('gc-cat-overlay--open');
    document.documentElement.classList.add('gc-cat-lock');
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
    btn.innerHTML = '<span class="gc-cat-btn-ic">' + ICON_SVG + '</span><span>Try on</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var title = (img.getAttribute('alt') || handle.replace(/-/g, ' ')).trim();
      var garment = normalizeImage(img.currentSrc || img.src);
      openDialog(handle, title, garment);
    });

    cfgPromise.then(function (c) {
      if (c) {
        btn.style.background = c.accentBg || '';
        btn.style.color = c.accentFg || '';
        if (typeof c.radiusPx === 'number') {
          btn.style.borderRadius = Math.min(c.radiusPx, 999) + 'px';
        }
      }
      // A stable position relative to the card image.
      var host = img.closest('a') || img.parentElement || card;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      host.appendChild(btn);
    });
  }

  function init() {
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
