/**
 * GRINDCTRL Try-On for WooCommerce and WordPress stores: storefront script.
 *
 * Loaded by the GRINDCTRL Store Chat plugin only on pages that render a
 * Try-On button. The plugin prints the button, the page settings in
 * window.grindctrlTryOn, and nothing secret:
 *
 *   { restUrl, storeApi, storeApiNonce, cartUrl, checkoutUrl, locale, rtl }
 *
 * On click this script asks the plugin's own REST route for a short-lived
 * embed URL (the plugin signs that call; the secret never reaches the
 * browser), opens the Try-On in a sheet, and after a result adds the item to
 * the WooCommerce cart through the Store API.
 *
 * Fails quiet: an error here must never affect the store page.
 */
(function () {
  'use strict';

  var CFG = window.grindctrlTryOn;
  if (!CFG || typeof CFG.restUrl !== 'string' || window.__grindctrlTryOnWoo) return;
  window.__grindctrlTryOnWoo = true;

  var BUTTON = '.gc-tryon-btn[data-product-id]';
  var locale = String(CFG.locale || document.documentElement.lang || '').toLowerCase().split(/[-_]/)[0] === 'ar' ? 'ar' : 'en';

  var COPY = {
    en: {
      close: 'Close',
      chooseOptions: 'Choose your options first, then try it on.',
      unavailable: 'Try-on could not be started. Please try again.',
      retry: 'Try again',
      addFailed: 'This item could not be added to the cart.',
      chooseOnPage: 'Choose your options on the product page, then add it to the cart.'
    },
    ar: {
      close: 'إغلاق',
      chooseOptions: 'اختر الخيارات أولاً ثم جرّب المنتج.',
      unavailable: 'تعذّر بدء التجربة. حاول مرة أخرى.',
      retry: 'إعادة المحاولة',
      addFailed: 'تعذّرت إضافة هذا المنتج إلى السلة.',
      chooseOnPage: 'اختر الخيارات من صفحة المنتج ثم أضفه إلى السلة.'
    }
  };
  var t = COPY[locale];

  /* ── Styles ─────────────────────────────────────────────────────────── */

  function injectStyles() {
    if (document.getElementById('gc-tryon-woo-css')) return;
    var style = document.createElement('style');
    style.id = 'gc-tryon-woo-css';
    style.textContent = [
      '.gc-tryon-btn{--gc-bg:#1f1d1a;--gc-fg:#f6f1e7;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;',
      'min-block-size:44px;min-inline-size:44px;padding-block:.65rem;padding-inline:1.25rem;margin-block:.5rem;border:0;',
      'border-radius:var(--gc-radius,10px);background:var(--gc-bg);color:var(--gc-fg);font:inherit;font-weight:600;',
      'line-height:1.2;cursor:pointer;text-decoration:none}',
      '.gc-tryon-btn:focus-visible{outline:3px solid currentColor;outline-offset:3px}',
      '.gc-tryon-btn[disabled]{opacity:.6;cursor:progress}',
      '.gc-tryon-btn--card{margin-block:.25rem;padding-block:.45rem;padding-inline:.9rem;font-size:.875rem}',
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
      '@media (prefers-reduced-motion:reduce){.gc-tryon-sheet__backdrop,.gc-tryon-sheet__panel{transition:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  /* ── Page reads ─────────────────────────────────────────────────────── */

  // A card's button must not read the product page's form beside it.
  function variationsForm(button) {
    return button.closest('form.variations_form') ||
      (button.dataset.gcPage === '1' ? document.querySelector('form.variations_form') : null);
  }

  /* The variation the shopper picked with the theme's own selectors, and
     the attributes behind it (needed to add an "any" variation to the cart). */
  function readVariation(button) {
    var form = button.dataset.productType === 'variable' ? variationsForm(button) : null;
    if (!form) return { id: 0, attributes: [] };
    var input = form.querySelector('[name="variation_id"]');
    var id = input && /^[1-9]\d{0,15}$/.test(input.value) ? Number(input.value) : 0;
    var attributes = [];
    form.querySelectorAll('[name^="attribute_"]').forEach(function (field) {
      if (field.value) attributes.push({ attribute: field.name.replace(/^attribute_/, ''), value: field.value });
    });
    return { id: id, attributes: attributes };
  }

  function plainText(message) {
    try {
      return (new DOMParser().parseFromString(String(message || ''), 'text/html').body.textContent || '').slice(0, 160);
    } catch (_) {
      return '';
    }
  }

  /* ── Notes next to the button ───────────────────────────────────────── */

  function clearNote(button) {
    var next = button.nextElementSibling;
    if (next && next.classList.contains('gc-tryon-note')) next.remove();
  }

  function showNote(button, message, retry) {
    clearNote(button);
    var note = document.createElement('div');
    note.className = 'gc-tryon-note';
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
    panel.appendChild(frame);
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
      destroy: function () { hide(false); if (sheet.parentNode) sheet.parentNode.removeChild(sheet); }
    };
  }

  /* ── Cart (WooCommerce Store API) ───────────────────────────────────── */

  var storeNonce = typeof CFG.storeApiNonce === 'string' ? CFG.storeApiNonce : '';

  function storeApi(path, init) {
    var headers = { Accept: 'application/json' };
    if (init && init.body) headers['Content-Type'] = 'application/json';
    if (storeNonce) headers.Nonce = storeNonce;
    return fetch(CFG.storeApi + path, {
      method: (init && init.method) || 'GET',
      credentials: 'same-origin',
      headers: headers,
      body: init && init.body
    }).then(function (res) {
      var fresh = res.headers.get('Nonce');
      if (fresh) storeNonce = fresh;
      return res;
    });
  }

  function refreshCartUi() {
    try {
      if (window.jQuery) window.jQuery(document.body).trigger('wc_fragment_refresh');
      document.body.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart', { bubbles: true, detail: { preserveCartData: false } }));
    } catch (_) { /* the add itself succeeded; the count catches up on the next page */ }
  }

  /* A page cache can freeze the nonce printed in the page: on a refusal, read
     a fresh one from the cart response header and try once more. */
  function addToCart(id, attributes) {
    var payload = { id: id, quantity: 1 };
    if (attributes.length) payload.variation = attributes;
    var body = JSON.stringify(payload);
    function attempt() { return storeApi('cart/add-item', { method: 'POST', body: body }); }
    var ready = storeNonce ? Promise.resolve() : storeApi('cart').then(function () {});
    return ready.then(attempt).then(function (res) {
      if (res.status === 401 || res.status === 403) {
        return storeApi('cart').then(attempt);
      }
      return res;
    });
  }

  /* ── Click flow ─────────────────────────────────────────────────────── */

  var sessions = new WeakMap();

  function embedOriginOf(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === 'https:' && !parsed.username ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function requestContext(productId, variationId) {
    return fetch(CFG.restUrl + 'tryon-context', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ product_id: productId, variation_id: variationId || 0 })
    }).then(function (res) {
      // 409/403: this store cannot start a look now (no looks left, plan lapsed).
      if (res.status === 409 || res.status === 403) {
        var hidden = new Error('try_on_hidden');
        hidden.hidden = true;
        throw hidden;
      }
      if (!res.ok) throw new Error('context_unavailable');
      return res.json();
    }).then(function (data) {
      if (!data || typeof data.embedUrl !== 'string') throw new Error('context_invalid');
      return data;
    });
  }

  /* The product's variations, for the sheet's size picker. Display data from
     the plugin's public route; only a variation listed here can be added. */
  function requestProduct(productId) {
    var join = CFG.restUrl.indexOf('?') === -1 ? '?' : '&';
    return fetch(CFG.restUrl + 'tryon-product' + join + 'product_id=' + productId, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      return data && data.product && Array.isArray(data.product.variants) ? data.product : null;
    }).catch(function () { return null; });
  }

  function openTryOn(button) {
    var existing = sessions.get(button);
    // Reopening resumes whatever the sheet held, a look included.
    if (existing) { existing.sheet.open(); return; }

    var productId = Number(button.dataset.productId);
    if (!productId) return;
    var picked = readVariation(button);
    if (button.dataset.productType === 'variable' && variationsForm(button) && !picked.id) {
      showNote(button, t.chooseOptions, false);
      return;
    }

    clearNote(button);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    requestContext(productId, picked.id).then(function (data) {
      var target = embedOriginOf(data.embedUrl);
      if (!target) throw new Error('context_invalid');

      var frame = document.createElement('iframe');
      frame.className = 'gc-tryon-frame';
      frame.title = 'GRINDCTRL Try-On';
      frame.setAttribute('allow', 'camera; clipboard-write');
      frame.src = target.href;
      var sheet = createSheet(button, frame);
      var addId = picked.id || productId;
      var storeProduct = null;

      function reply(message) {
        if (frame.contentWindow) frame.contentWindow.postMessage(message, target.origin);
      }

      window.addEventListener('message', function (event) {
        if (event.source !== frame.contentWindow || event.origin !== target.origin || !event.data) return;
        var type = event.data.type;
        if (type === 'grindctrl-tryon:close') { sheet.close(); return; }
        if (type === 'grindctrl-tryon:checkout') { window.location.href = CFG.checkoutUrl || '/checkout/'; return; }
        if (type === 'grindctrl-tryon:refresh') {
          sheet.destroy();
          sessions.delete(button);
          button.click();
          return;
        }
        if (type === 'grindctrl-tryon:product-request') {
          requestProduct(productId).then(function (product) {
            if (!product || !product.variants.length) return;
            storeProduct = product;
            reply({ type: 'grindctrl-tryon:product', product: product, variant: picked.id });
          });
          return;
        }
        if (type === 'grindctrl-tryon:add-to-cart') {
          // The look was made for one product (or variation); that is what is added.
          if (button.dataset.productType === 'variable' && !picked.id) {
            reply({ type: 'grindctrl-tryon:cart-result', ok: false, message: t.chooseOnPage });
            return;
          }
          var cartId = addId;
          var cartAttributes = picked.attributes;
          // The sheet may name another size of this same product, never anything else.
          var asked = String(event.data.variantId || '');
          if (asked && asked !== String(addId)) {
            var chosen = null;
            if (storeProduct) {
              for (var i = 0; i < storeProduct.variants.length; i++) {
                if (String(storeProduct.variants[i].id) === asked) { chosen = storeProduct.variants[i]; break; }
              }
            }
            if (!chosen || !Array.isArray(chosen.attributes)) {
              reply({ type: 'grindctrl-tryon:cart-result', ok: false, message: t.addFailed });
              return;
            }
            cartId = Number(chosen.id);
            cartAttributes = chosen.attributes;
          }
          addToCart(cartId, cartAttributes).then(function (res) {
            if (res.ok) {
              reply({ type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: '' });
              refreshCartUi();
              return;
            }
            return res.json().then(
              function (error) { reply({ type: 'grindctrl-tryon:cart-result', ok: false, message: plainText(error && error.message) || t.addFailed }); },
              function () { reply({ type: 'grindctrl-tryon:cart-result', ok: false, message: t.addFailed }); }
            );
          }).catch(function () {
            reply({ type: 'grindctrl-tryon:cart-result', ok: false, message: t.addFailed });
          });
        }
      });

      sessions.set(button, { sheet: sheet });
      sheet.open();
    }).catch(function (error) {
      if (error && error.hidden) {
        // The looks ran out after this page loaded: take the button away
        // rather than show an error the shopper cannot act on.
        clearNote(button);
        button.remove();
        return;
      }
      showNote(button, t.unavailable, true);
    }).then(function () {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    });
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest(BUTTON) : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    try { openTryOn(button); } catch (_) { showNote(button, t.unavailable, true); }
  });

  injectStyles();
})();
