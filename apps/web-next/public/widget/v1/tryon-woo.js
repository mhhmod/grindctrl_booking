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
 * This file is the WooCommerce adapter only. The button, sheet, prewarm,
 * ready badge and messaging are the shared hosted engine (tryon-engine.js),
 * so a Try-On change ships once for every platform.
 *
 * Fails quiet: an error here must never affect the store page.
 */
(function () {
  'use strict';

  var CFG = window.grindctrlTryOn;
  if (!CFG || typeof CFG.restUrl !== 'string' || window.__grindctrlTryOnWoo) return;
  window.__grindctrlTryOnWoo = true;

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

  /* ── Plugin REST (the plugin signs these calls; no secret in the browser) ── */

  function requestContext(productId, variationId) {
    var payload = { product_id: productId, variation_id: variationId || 0 };
    var preview = previewToken();
    if (preview) payload.preview = preview;
    return fetch(CFG.restUrl + 'tryon-context', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
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

  function requestProduct(productId) {
    var join = CFG.restUrl.indexOf('?') === -1 ? '?' : '&';
    var preview = previewToken();
    return fetch(CFG.restUrl + 'tryon-product' + join + 'product_id=' + productId +
      (preview ? '&preview=' + encodeURIComponent(preview) : ''), {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      return res.ok ? res.json() : null;
    }).then(function (data) {
      return data && data.product && Array.isArray(data.product.variants) ? data.product : null;
    }).catch(function () { return null; });
  }

  var chatScript = document.querySelector('script[src*="/widget/v1/messenger.js"][data-key]');
  var adapter = {
    signalKey: CFG.embedKey || (chatScript && chatScript.getAttribute('data-key')),
    embedOrigin: new URL(document.currentScript ? document.currentScript.src : 'https://grindctrl.cloud/widget/v1/tryon-woo.js').origin,
    locale: CFG.locale,
    placementTarget: function (button) { return button; },
    detectProduct: function (button) {
      var variation = readVariation(button);
      return { id: Number(button.dataset.productId), variantId: variation.id, attributes: variation.attributes };
    },
    getContext: function (product) { return requestContext(product.id, product.variantId); },
    getProduct: function (product) { return requestProduct(product.id); },
    lookKey: function (button) { return 'woo:' + CFG.restUrl + ':woo-' + button.dataset.productId; },
    messageProductId: function (product) { return 'woo-' + product.id; },
    checkout: function () { window.location.href = CFG.checkoutUrl || '/checkout/'; },
    addToCart: function (variant, qty, state) {
      var product = state.product;
      var addId = product.variantId || product.id;
      if (state.button.dataset.productType === 'variable' && !product.variantId && variant === String(product.id)) {
        return Promise.resolve({ ok: false, message: state.copy.chooseOnPage });
      }
      var attributes = product.attributes;
      if (variant !== String(addId)) {
        var chosen = state.storeProduct && state.storeProduct.variants.find(function (v) { return String(v.id) === variant; });
        if (!chosen || !Array.isArray(chosen.attributes)) return Promise.resolve({ ok: false, message: state.copy.addFailed });
        attributes = chosen.attributes;
      }
      return addToCart(Number(variant), attributes).then(function (res) {
        if (res.ok) { refreshCartUi(); return { ok: true, variantTitle: '' }; }
        return res.json().then(function (error) { return { ok: false, message: plainText(error && error.message) || state.copy.addFailed }; });
      });
    }
  };
  /* Where the product page button goes (Pack B): the owner's placement from
     the public Try-On config, read only on a product page. The buttons work
     from the moment the engine mounts; the placement is applied when it
     arrives, within PLACEMENT_WAIT_MS. A slow or failed read keeps the
     button where the plugin printed it (automatic). */
  var PLACEMENT_WAIT_MS = 1500;
  function readPlacement() {
    var key = adapter.signalKey;
    if (!key || !/^[A-Za-z0-9_-]{6,128}$/.test(key) || !document.querySelector('.gc-tryon-btn[data-gc-page="1"]')) return Promise.resolve(null);
    var request = fetch(adapter.embedOrigin + '/api/woo/tryon-config?key=' + encodeURIComponent(key) +
      '&locale=' + (CFG.locale === 'ar' ? 'ar' : 'en'), { credentials: 'omit', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (config) {
        return config && (config.placement === 'spot' || config.placement === 'floating')
          ? { placement: config.placement, spot: config.spot } : null;
      }).catch(function () { return null; });
    return Promise.race([request, new Promise(function (resolve) { setTimeout(function () { resolve(null); }, PLACEMENT_WAIT_MS); })]);
  }
  var started = false;
  function start() {
    if (started) return;
    started = true;
    var engine = window.GRINDCTRL_TRYON_ENGINE;
    // An edit link from the dashboard opened this tab: the engine verifies it first.
    if (engine.bootPick) engine.bootPick(adapter.embedOrigin);
    adapter.placementLater = true;
    var handle = engine.mount(adapter);
    readPlacement().then(function (placement) { if (handle && handle.place) handle.place(placement); });
  }
  if (window.GRINDCTRL_TRYON_ENGINE) { start(); return; }
  // The engine is served beside this file, from the same versioned directory.
  var script = document.createElement('script');
  script.src = new URL('tryon-engine.js?v=903f9d4af03c', document.currentScript ? document.currentScript.src : 'https://grindctrl.cloud/widget/v1/tryon-woo.js').href;
  script.async = true;
  script.onload = start;
  // Without the engine a button would do nothing: take them away instead.
  script.onerror = function () {
    document.querySelectorAll('.gc-tryon-btn[data-product-id]').forEach(function (button) { button.style.display = 'none'; });
  };
  document.head.appendChild(script);
})();
