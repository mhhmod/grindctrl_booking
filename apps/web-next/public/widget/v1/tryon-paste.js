/**
 * GRINDCTRL Try-On paste adapters v1.1.0 (website and Shopify paste installs).
 *
 * Loaded by messenger.js on product pages of a `data-gc-install="paste"`
 * snippet, then mounted on the hosted engine (tryon-engine.js). Everything
 * read from the page is display or cart data; the signed context minted by
 * /api/try-on/paste-context is the only authority for a look.
 *
 * Adapter contract (consumed by tryon-engine.js):
 *   detectProduct(button?)  -> { id, variantId, title, imageUrl, price, currency } | null
 *   getContext(product)     -> Promise<{ embedUrl, context: { expiresAt }, settings? }>
 *                              rejects with error.hidden = true when the store cannot start a look
 *   addToCart(variant, qty) -> Promise<{ ok, message?, variantTitle? } | 'unsupported'>
 *   placementTarget()       -> Element the injected button goes after | null
 */
(function () {
  'use strict';
  if (window.GRINDCTRL_TRYON_PASTE) return;

  // Same rule as the server's product handle validator (lib/try-on/validator.ts).
  var PRODUCT_ID = /^[a-z0-9][a-z0-9_-]{0,99}$/;
  // The server answers these when the store cannot start a look right now:
  // the button goes away instead of showing an error the shopper cannot act on.
  var HIDDEN = ['paste_not_connected', 'site_disconnected', 'origin_not_allowed', 'bad_signature', 'free_plan_taken',
    'preview', 'holdout', 'garment_unsafe', 'out_of_looks', 'paused', 'not_installed', 'plan_inactive', 'not_found'];

  function image(value) {
    if (Array.isArray(value)) value = value[0];
    if (value && typeof value === 'object') value = value.url || value.contentUrl;
    if (typeof value !== 'string' || !value) return '';
    try {
      var url = new URL(value, window.location.href);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }
  function productId(value) {
    var id = String(value == null ? '' : value).trim().toLowerCase();
    return PRODUCT_ID.test(id) ? id : '';
  }
  function meta(name) {
    var node = document.querySelector('meta[property="' + name + '"],meta[name="' + name + '"]');
    return node ? node.content : '';
  }
  function pathSlug() {
    try { return decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || ''); } catch (_) { return ''; }
  }

  /* JSON-LD Product (arrays, @graph, mainEntity, ProductGroup.hasVariant),
     then Open Graph product:*, then the explicit tag. */
  function websiteProduct() {
    function fromProduct(node) {
      var offer = Array.isArray(node.offers) ? node.offers[0] : node.offers || {};
      // A stable SKU or the page slug. Never an array index.
      var id = productId(node.productID || node.sku || node.mpn) || productId(pathSlug());
      var photo = image(node.image);
      if (!id || !photo) return null;
      var price = offer && (offer.price != null ? offer.price : offer.lowPrice);
      return { id: id, variantId: null, title: String(node.name || '').trim().slice(0, 200), imageUrl: photo,
        price: price != null && price !== '' ? price : null, currency: (offer && offer.priceCurrency) || null };
    }
    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 6) return null;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) { var found = walk(node[i], depth + 1); if (found) return found; }
        return null;
      }
      var types = [].concat(node['@type'] || []);
      if (types.some(function (type) { return /(^|[/#])Product$/.test(String(type)); })) {
        var product = fromProduct(node);
        if (product) return product;
      }
      return walk(node['@graph'], depth + 1) || walk(node.mainEntity, depth + 1) || walk(node.hasVariant, depth + 1);
    }
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try { var product = walk(JSON.parse(scripts[i].textContent), 0); if (product) return product; } catch (_) { /* next source */ }
    }
    if (meta('product:retailer_item_id') || meta('product:price:amount') || /^(product|og:product)$/.test(meta('og:type'))) {
      var og = fromProduct({ productID: meta('product:retailer_item_id'), name: meta('og:title'), image: meta('og:image'),
        offers: { price: meta('product:price:amount'), priceCurrency: meta('product:price:currency') } });
      if (og) return og;
    }
    var tag = document.querySelector('[data-grindctrl-tryon][data-product-id][data-title][data-image]');
    return tag ? fromProduct({ productID: tag.dataset.productId, name: tag.dataset.title, image: tag.dataset.image }) : null;
  }

  function shopifyForm() { return document.querySelector('form[action*="/cart/add"]'); }
  function shopifyRoot() {
    var root = window.Shopify && window.Shopify.routes && window.Shopify.routes.root;
    return typeof root === 'string' && /^\/(?!\/)/.test(root) ? root : '/';
  }
  function shopifyCurrency() {
    var currency = window.Shopify && window.Shopify.currency && window.Shopify.currency.active;
    return typeof currency === 'string' ? currency : null;
  }
  function signedFrom(node) {
    var d = node.dataset;
    return { siteId: d.gcSite || '', shopDomain: d.gcShop || '', productId: d.gcProduct || '', variantId: d.gcVariant || '',
      issuedAt: d.gcIssuedAt || '', customerId: d.gcCustomer || '', signature: d.gcSignature || '' };
  }

  /* Same cart follow-up as the Shopify app loader: the theme's own cart
     update event (Dawn pub/sub refreshes its drawer), cart:refresh for
     event-driven themes, and any marked count. Never navigates. */
  function refreshShopifyCart(variantId) {
    return fetch(shopifyRoot() + 'cart.js', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cart) {
        if (!cart || typeof cart.item_count !== 'number') return;
        try {
          if (typeof window.publish === 'function' && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
            window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'grindctrl-tryon', productVariantId: variantId, cartData: cart });
          }
        } catch (_) { /* a theme handler failing must not break ours */ }
        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } }));
        var counts = document.querySelectorAll('[data-cart-count], .cart-count-bubble span[aria-hidden="true"]');
        for (var i = 0; i < counts.length; i++) counts[i].textContent = String(cart.item_count);
      })
      .catch(function () { /* the add succeeded; the count catches up on the next page */ });
  }

  function create(options) {
    var script = options.script;
    var platform = script.dataset.gcPlatform === 'shopify' ? 'shopify' : 'website';
    var signed = platform === 'shopify' ? signedFrom(script) : null;
    var productJson = null;
    var initialProduct = null;
    var context = null;
    var pending = null;

    function findVariant(id) {
      if (!productJson) return null;
      for (var i = 0; i < productJson.variants.length; i++) {
        if (String(productJson.variants[i].id) === String(id)) return productJson.variants[i];
      }
      return null;
    }

    /* A Liquid render is single use per visitor and fresh for 15 minutes.
       After the first context expires (or the page sat open), read a new
       render of this same product page; its signature is checked again by
       the server like the first one. */
    function refreshSignedRender(selectedVariant) {
      var url = new URL(window.location.href);
      url.hash = '';
      if (/^\d{1,20}$/.test(selectedVariant || '')) url.searchParams.set('variant', selectedVariant);
      url.searchParams.set('gc_render', String(Date.now()));
      return fetch(url.pathname + url.search, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/html' } })
        .then(function (res) { return res.ok ? res.text() : ''; })
        .then(function (html) {
          // DOMParser never runs the fetched page's scripts.
          var node = new DOMParser().parseFromString(html, 'text/html')
            .querySelector('script[data-gc-install="paste"][data-gc-signature]');
          if (!node) return false;
          var fresh = signedFrom(node);
          if (fresh.siteId !== signed.siteId || fresh.shopDomain !== signed.shopDomain || fresh.productId !== signed.productId ||
              !/^\d{1,20}$/.test(fresh.variantId) || (fresh.issuedAt === signed.issuedAt && fresh.signature === signed.signature)) return false;
          signed = fresh;
          return true;
        })
        .catch(function () { return false; });
    }

    function requestContext(product, retried) {
      var body = { key: script.dataset.key, productId: product.id, variantId: signed ? signed.variantId : null,
        title: product.title, imageUrl: product.imageUrl, pageUrl: window.location.href, locale: options.locale,
        visitorId: options.visitorId, preview: options.preview || undefined, signed: signed || undefined };
      return fetch(options.appOrigin + '/api/try-on/paste-context', {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body)
      }).then(function (res) {
        if (res.ok) return res.json();
        return res.json().catch(function () { return {}; }).then(function (failure) {
          var code = failure && typeof failure.error === 'string' ? failure.error : '';
          if (signed && !retried && (code === 'replayed' || code === 'stale_signature')) {
            return refreshSignedRender(product.variantId).then(function (refreshed) {
              if (refreshed) return requestContext(product, true);
              throw new Error(code);
            });
          }
          var error = new Error(code || 'context_unavailable');
          error.hidden = HIDDEN.indexOf(code) !== -1;
          throw error;
        });
      });
    }

    // Presentation only: the shopper's selection never replaces the signed variant.
    function displayContext(data, product) {
      var url = new URL(data.embedUrl);
      if (platform === 'website') url.searchParams.set('cart', 'unsupported');
      if (product.variantId) url.searchParams.set('selectedVariant', product.variantId);
      var selected = findVariant(product.variantId);
      if (selected && selected.title) url.searchParams.set('variantTitle', selected.title);
      return { embedUrl: url.href, context: data.context, settings: data.settings };
    }

    var adapter = {
      injectButton: true,
      locale: options.locale,
      embedOrigin: options.appOrigin,
      // The Shopify block's default label; the owner's own label arrives with the context settings.
      buttonLabel: options.locale === 'ar' ? 'جرّبها بالذكاء الاصطناعي' : 'Try it on with AI',
      lookKey: function (button) { return 'paste:' + script.dataset.key + ':' + button.dataset.productId; },
      messageProductId: function (product) { return String(product.id); },

      prepare: function () {
        if (platform === 'website') {
          initialProduct = websiteProduct();
          return Promise.resolve(!!initialProduct);
        }
        var match = window.location.pathname.match(/\/products\/([^/]+)/);
        if (!match || !/^\d{1,20}$/.test(signed.productId) || !shopifyForm()) return Promise.resolve(false);
        var handle;
        try { handle = decodeURIComponent(match[1]); } catch (_) { return Promise.resolve(false); }
        return fetch(shopifyRoot() + 'products/' + encodeURIComponent(handle) + '.js', {
          credentials: 'same-origin', headers: { Accept: 'application/json' }
        }).then(function (res) { return res.ok ? res.json() : null; }).then(function (data) {
          // The public JSON must describe the product Liquid signed.
          if (!data || String(data.id) !== signed.productId || !Array.isArray(data.variants)) return false;
          productJson = data;
          return !!adapter.detectProduct();
        }).catch(function () { return false; });
      },

      placementTarget: function () {
        if (platform === 'shopify') return shopifyForm();
        return document.querySelector('button[name="add-to-cart"],button[name="add"],[data-add-to-cart],.single_add_to_cart_button') ||
          document.querySelector('[data-grindctrl-tryon]');
      },

      detectProduct: function () {
        if (platform === 'website') return initialProduct;
        if (!productJson) return null;
        var form = shopifyForm();
        var field = form && form.querySelector('[name="id"]');
        // Re-read at every tap: the theme's own variant picker writes this field.
        var variant = findVariant(field && field.value) || findVariant(signed.variantId);
        if (!variant) return null;
        var photo = image(variant.featured_image && variant.featured_image.src) || image(productJson.featured_image) || image(productJson.images);
        if (!photo) return null;
        return { id: signed.productId, variantId: String(variant.id), title: String(productJson.title || '').slice(0, 200),
          imageUrl: photo, price: typeof variant.price === 'number' ? variant.price : null, currency: shopifyCurrency() };
      },

      getContext: function (product) {
        // One short-lived context serves prewarm, reopen and variant changes;
        // replaying the same Liquid render for this visitor is refused anyway.
        if (context && Date.parse(context.context.expiresAt) > Date.now() + 5000) {
          return Promise.resolve(displayContext(context, product));
        }
        if (!pending) {
          pending = requestContext(product, false).then(function (data) {
            if (!data || typeof data.embedUrl !== 'string' || !data.context) throw new Error('context_invalid');
            context = data;
            return data;
          });
          pending.then(function () { pending = null; }, function () { pending = null; });
        }
        return pending.then(function (data) { return displayContext(data, product); });
      },

      getProduct: function () {
        if (!productJson) return Promise.resolve(null);
        return Promise.resolve({
          options: (productJson.options || []).map(function (option) { return typeof option === 'string' ? option : (option && option.name) || ''; }),
          currency: shopifyCurrency(),
          variants: productJson.variants.slice(0, 250).map(function (v) {
            return { id: v.id, title: v.title || '', available: v.available === true, price: typeof v.price === 'number' ? v.price : null,
              options: [v.option1, v.option2, v.option3].filter(function (value) { return typeof value === 'string'; }) };
          })
        });
      },

      addToCart: function (variant, qty) {
        if (platform !== 'shopify') return Promise.resolve('unsupported');
        // Only a variant of the product on this page, whatever the sheet asks for.
        var chosen = findVariant(variant);
        if (!chosen || !Number.isInteger(qty) || qty < 1 || qty > 99) return Promise.resolve({ ok: false });
        return fetch(shopifyRoot() + 'cart/add.js', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: [{ id: chosen.id, quantity: qty }] })
        }).then(function (res) {
          return res.json().catch(function () { return null; }).then(function (data) {
            if (!res.ok) {
              var message = data && (data.description || data.message);
              return { ok: false, message: typeof message === 'string' ? message.slice(0, 160) : '' };
            }
            refreshShopifyCart(chosen.id);
            var item = data && data.items && data.items[0];
            return { ok: true, variantTitle: (item && item.variant_title) || '' };
          });
        });
      },

      // Only from the sheet's explicit Checkout tap.
      checkout: function () { if (platform === 'shopify') window.location.href = shopifyRoot() + 'cart'; }
    };
    return adapter;
  }

  window.GRINDCTRL_TRYON_PASTE = { version: '1.1.0', create: create, detectWebsiteProduct: websiteProduct };
})();
