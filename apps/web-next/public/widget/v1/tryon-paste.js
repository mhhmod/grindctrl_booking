/**
 * GRINDCTRL Try-On paste adapters v1.3.0 (website and Shopify paste installs).
 *
 * Loaded by messenger.js on product pages of a `data-gc-install="paste"`
 * snippet, and on Shopify product listings whose snippet printed signed
 * product cards, then mounted on the hosted engine (tryon-engine.js).
 * Everything read from the page is display or cart data; the signed context
 * minted by /api/try-on/paste-context is the only authority for a look.
 *
 * Adapter contract (consumed by tryon-engine.js):
 *   detectProduct(button?)  -> { id, variantId, title, imageUrl, price, currency } | null
 *   getContext(product)     -> Promise<{ embedUrl, context: { expiresAt }, settings? }>
 *                              rejects with error.hidden = true when the store cannot
 *                              start a look; error.scope 'product' when only this
 *                              product cannot (its card pill goes, the rest stay)
 *   addToCart(variant, qty, state) -> Promise<{ ok, message?, variantTitle? } | 'unsupported'>
 *   placementTarget()       -> Element the injected button goes after | null
 *   injectButton            -> the product page button (after prepare)
 *   buttonSettings          -> its owner's look from /api/try-on/paste-config, null when unread
 *   injectCards, cardSettings, findCards(rescan) -> product card pills (after prepare)
 */
(function () {
  'use strict';
  if (window.GRINDCTRL_TRYON_PASTE) return;

  // Same rule as the server's product handle validator (lib/try-on/validator.ts).
  var PRODUCT_ID = /^[a-z0-9][a-z0-9_-]{0,99}$/;
  var SHOPIFY_ID = /^\d{1,20}$/;
  // The server answers these when the store cannot start a look right now:
  // the button goes away instead of showing an error the shopper cannot act on.
  var HIDDEN = ['paste_not_connected', 'site_disconnected', 'origin_not_allowed', 'bad_signature', 'free_plan_taken',
    'preview', 'holdout', 'garment_unsafe', 'out_of_looks', 'paused', 'not_installed', 'plan_inactive', 'not_found',
    // Until the merchant's store is confirmed, or while the Shopify app owns it.
    'shop_proof_pending', 'shopify_app_installed'];
  // Of those, the ones about this product only: other cards keep their pill.
  var PRODUCT_HIDDEN = ['bad_signature', 'garment_unsafe'];
  // Signed cards the snippet prints at most (lib/paste/types.ts PASTE_CARD_LIMIT).
  var CARD_LIMIT = 50;
  // The theme's product card around a product link (same list as the Shopify app's catalog embed).
  var CARD = 'li, .grid__item, .card-wrapper, .product-card, [class*="product-item"]';
  // Re-reading this listing for cards the first render did not sign (filters, sorting).
  var MAX_CARD_REFRESHES = 3;

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
  // The snippet HTML-escapes every card string before JSON encoding it (Liquid's escape filter).
  function unescapeHtml(value) {
    return typeof value !== 'string' ? '' : value.replace(/&(amp|lt|gt|quot|#39);/g, function (_, name) {
      return { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[name];
    });
  }
  function productHandle(href) {
    var match = String(href || '').match(/\/products\/([^/?#]+)/);
    if (!match) return '';
    try { return decodeURIComponent(match[1]).toLowerCase(); } catch (_) { return ''; }
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
  function findVariantIn(json, id) {
    if (!json || !Array.isArray(json.variants)) return null;
    for (var i = 0; i < json.variants.length; i++) {
      if (String(json.variants[i].id) === String(id)) return json.variants[i];
    }
    return null;
  }
  function productOptions(json) {
    return {
      options: (json.options || []).map(function (option) { return typeof option === 'string' ? option : (option && option.name) || ''; }),
      currency: shopifyCurrency(),
      variants: json.variants.slice(0, 250).map(function (v) {
        return { id: v.id, title: v.title || '', available: v.available === true, price: typeof v.price === 'number' ? v.price : null,
          options: [v.option1, v.option2, v.option3].filter(function (value) { return typeof value === 'string'; }) };
      })
    };
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
    // Which snippet this store runs; sent so the dashboard can ask for the new code.
    var codeVersion = Number(script.dataset.gcV);
    if (!(codeVersion >= 1 && codeVersion <= 99 && codeVersion % 1 === 0)) codeVersion = 1;
    var productJson = null;
    var initialProduct = null;
    var context = null;
    var pending = null;
    // Product cards (Shopify listings): signed entries by product id and by handle.
    var cardsById = {};
    var cardsByHandle = {};
    var cardContexts = {};
    var cardPending = {};
    var cardJson = {};
    var cardRefreshes = 0;
    var cardRefreshedUrls = {};
    var cardRefreshing = false;

    /* A Liquid render is single use per visitor and fresh for 15 minutes.
       When one was used or went stale, read a new render of a product page;
       the server checks its signature again like the first one. */
    function fetchSignedTag(url, expectedProduct, previous) {
      url.hash = '';
      url.searchParams.set('gc_render', String(Date.now()));
      return fetch(url.pathname + url.search, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/html' } })
        .then(function (res) { return res.ok ? res.text() : ''; })
        .then(function (html) {
          // DOMParser never runs the fetched page's scripts.
          var node = new DOMParser().parseFromString(html, 'text/html')
            .querySelector('script[data-gc-install="paste"][data-gc-signature]');
          if (!node) return null;
          var fresh = signedFrom(node);
          if (fresh.siteId !== signed.siteId || fresh.shopDomain !== signed.shopDomain || fresh.productId !== expectedProduct ||
              !SHOPIFY_ID.test(fresh.variantId) || (fresh.issuedAt === previous.issuedAt && fresh.signature === previous.signature)) return null;
          return fresh;
        })
        .catch(function () { return null; });
    }
    function refreshSignedRender(selectedVariant) {
      var url = new URL(window.location.href);
      if (SHOPIFY_ID.test(selectedVariant || '')) url.searchParams.set('variant', selectedVariant);
      return fetchSignedTag(url, signed.productId, signed).then(function (fresh) {
        if (fresh) signed = fresh;
        return fresh;
      });
    }
    function refreshCardRender(card) {
      var url = new URL(shopifyRoot() + 'products/' + encodeURIComponent(card.handle), window.location.href);
      return fetchSignedTag(url, card.id, card.signed).then(function (fresh) {
        if (fresh) card.signed = fresh;
        return fresh;
      });
    }

    function requestContext(product, claims, refresh, retried) {
      var body = { key: script.dataset.key, productId: product.id, variantId: claims ? claims.variantId : null,
        title: product.title, imageUrl: product.imageUrl, pageUrl: window.location.href, locale: options.locale,
        visitorId: options.visitorId, preview: options.preview || undefined, signed: claims || undefined,
        codeVersion: platform === 'shopify' ? codeVersion : undefined };
      return fetch(options.appOrigin + '/api/try-on/paste-context', {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body)
      }).then(function (res) {
        if (res.ok) return res.json();
        return res.json().catch(function () { return {}; }).then(function (failure) {
          var code = failure && typeof failure.error === 'string' ? failure.error : '';
          if (claims && !retried && (code === 'replayed' || code === 'stale_signature')) {
            return refresh().then(function (fresh) {
              if (fresh) return requestContext(product, fresh, refresh, true);
              throw new Error(code);
            });
          }
          var error = new Error(code || 'context_unavailable');
          error.code = code;
          error.hidden = HIDDEN.indexOf(code) !== -1;
          error.scope = PRODUCT_HIDDEN.indexOf(code) !== -1 ? 'product' : 'store';
          throw error;
        });
      }).then(function (data) {
        if (!data || typeof data.embedUrl !== 'string' || !data.context) throw new Error('context_invalid');
        return data;
      });
    }

    // Presentation only: the shopper's selection never replaces the signed variant.
    function displayContext(data, product) {
      var url = new URL(data.embedUrl);
      if (platform === 'website') url.searchParams.set('cart', 'unsupported');
      if (product.variantId) url.searchParams.set('selectedVariant', product.variantId);
      var selected = findVariantIn(product.card ? cardJson[product.handle] : productJson, product.variantId);
      if (selected && selected.title) url.searchParams.set('variantTitle', selected.title);
      return { embedUrl: url.href, context: data.context, settings: data.settings };
    }
    function usable(data) { return !!data && Date.parse(data.context.expiresAt) > Date.now() + 5000; }

    /* ── Product cards ───────────────────────────────────────────────── */

    // Card images come from Liquid's image_url (protocol-relative, on the
    // storefront's own host); keep them on a host the page itself is on.
    function cardImage(value) {
      if (typeof value !== 'string' || !value) return '';
      if (value.indexOf('//') === 0) value = 'https:' + value;
      try {
        var url = new URL(value, window.location.href);
        if (url.hostname !== 'cdn.shopify.com' && url.hostname !== window.location.hostname) url.hostname = window.location.hostname;
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
      } catch (_) { return ''; }
    }

    /* The snippet's signed cards: a JSON block for this site and shop. Each
       entry is signed like the product page, with that product's ids. */
    function readCards(doc) {
      var node = doc.querySelector('script[type="application/json"][data-gc-cards]');
      if (!node || node.getAttribute('data-gc-cards') !== signed.siteId) return 0;
      var data;
      try { data = JSON.parse(node.textContent); } catch (_) { return 0; }
      if (!data || data.site !== signed.siteId || data.shop !== signed.shopDomain || !/^\d{1,12}$/.test(String(data.issuedAt)) ||
          !/^(\d{1,20})?$/.test(String(data.customer == null ? '' : data.customer)) || !Array.isArray(data.products)) return 0;
      var added = 0;
      data.products.slice(0, CARD_LIMIT).forEach(function (entry) {
        if (!entry || !SHOPIFY_ID.test(entry.id) || !SHOPIFY_ID.test(entry.variant) || !/^[a-f0-9]{64}$/.test(entry.signature)) return;
        var handle = unescapeHtml(entry.handle).toLowerCase();
        var photo = cardImage(unescapeHtml(entry.image));
        if (!handle || handle.length > 255 || !photo) return;
        var card = { id: entry.id, handle: handle, title: unescapeHtml(entry.title).trim().slice(0, 200), imageUrl: photo,
          signed: { siteId: signed.siteId, shopDomain: signed.shopDomain, productId: entry.id, variantId: entry.variant,
            issuedAt: String(data.issuedAt), customerId: String(data.customer == null ? '' : data.customer), signature: entry.signature } };
        cardsById[card.id] = card;
        cardsByHandle[handle] = card;
        added++;
      });
      return added;
    }

    /* Cards the first render did not sign because the theme filtered or
       sorted the grid in place (the address changed): read the listing at
       its new address, at most a few times and once per address, then ask
       the engine to look again. The address the page loaded with is never
       read again: its render is the one already on the page, so a listing
       longer than the signed cards costs nothing extra. */
    function listingAddress() { return window.location.href.split('#')[0]; }
    function refreshCards(rescan) {
      var href = listingAddress();
      if (cardRefreshing || cardRefreshes >= MAX_CARD_REFRESHES || cardRefreshedUrls[href]) return;
      cardRefreshing = true;
      cardRefreshes++;
      cardRefreshedUrls[href] = true;
      var url = new URL(href);
      url.hash = '';
      url.searchParams.set('gc_render', String(Date.now()));
      fetch(url.pathname + url.search, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/html' } })
        .then(function (res) { return res.ok ? res.text() : ''; })
        .then(function (html) { return readCards(new DOMParser().parseFromString(html, 'text/html')); })
        .catch(function () { return 0; })
        .then(function (added) { cardRefreshing = false; if (added) rescan(); });
    }

    function cardProductJson(card) {
      if (cardJson[card.handle]) return Promise.resolve(cardJson[card.handle]);
      return fetch(shopifyRoot() + 'products/' + encodeURIComponent(card.handle) + '.js', {
        credentials: 'same-origin', headers: { Accept: 'application/json' }
      }).then(function (res) { return res.ok ? res.json() : null; }).then(function (data) {
        // The public JSON must describe the product Liquid signed.
        if (!data || String(data.id) !== card.id || !Array.isArray(data.variants)) return null;
        cardJson[card.handle] = data;
        return data;
      }).catch(function () { return null; });
    }

    /* Whether this visitor may see Try-On now, and the owner's button and
       pill look: read once per page, null when it could not be read. */
    var configRequest = null;
    function readPasteConfig() {
      if (configRequest) return configRequest;
      var params = new URLSearchParams({ key: script.dataset.key || '', locale: options.locale === 'ar' ? 'ar' : 'en' });
      if (/^[A-Za-z0-9_-]{16,64}$/.test(options.visitorId || '')) params.set('vid', options.visitorId);
      if (options.preview) params.set('preview', options.preview);
      configRequest = fetch(options.appOrigin + '/api/try-on/paste-config?' + params.toString(), {
        credentials: 'omit', headers: { Accept: 'application/json' }
      }).then(function (res) { return res.ok ? res.json() : null; }).catch(function () { return null; });
      return configRequest;
    }

    function prepareCards() {
      if (!signed.siteId || !signed.shopDomain || !readCards(document)) return Promise.resolve(false);
      cardRefreshedUrls[listingAddress()] = true;
      // Nothing is added to the page until the store says pills are on for this visitor.
      return readPasteConfig().then(function (config) {
        if (!config || config.tryOn !== 'live' || config.showCardPill !== true) return false;
        adapter.injectCards = true;
        adapter.cardSettings = config;
        return true;
      });
    }

    /* The product button, as the Shopify app block: nothing until the config
       answers, nothing when it says hidden, the owner's look from the first
       paint when it says live. A config that cannot be read keeps the
       default look; paste-context still decides at prewarm or tap. */
    function prepareButton(found) {
      return Promise.all([found, readPasteConfig()]).then(function (results) {
        var config = results[1];
        if (!results[0] || (config && config.tryOn !== 'live')) return false;
        adapter.buttonSettings = config;
        adapter.injectButton = true;
        return true;
      });
    }

    var adapter = {
      injectButton: false,
      buttonSettings: null,
      injectCards: false,
      cardSettings: null,
      locale: options.locale,
      embedOrigin: options.appOrigin,
      // The Shopify block's default label; the owner's own label comes with buttonSettings (or the context settings).
      buttonLabel: options.locale === 'ar' ? 'جرّبها بالذكاء الاصطناعي' : 'Try it on with AI',
      cardLabel: options.locale === 'ar' ? 'جرّب' : 'Try on',
      lookKey: function (button) { return 'paste:' + script.dataset.key + ':' + button.dataset.productId; },
      messageProductId: function (product) { return String(product.id); },

      prepare: function () {
        if (platform === 'website') {
          initialProduct = websiteProduct();
          return initialProduct ? prepareButton(true) : Promise.resolve(false);
        }
        var match = window.location.pathname.match(/\/products\/([^/]+)/);
        if (!match || !shopifyForm()) return prepareCards();
        if (!SHOPIFY_ID.test(signed.productId)) return Promise.resolve(false);
        var handle;
        try { handle = decodeURIComponent(match[1]); } catch (_) { return Promise.resolve(false); }
        // The product and the config are read in parallel.
        return prepareButton(fetch(shopifyRoot() + 'products/' + encodeURIComponent(handle) + '.js', {
          credentials: 'same-origin', headers: { Accept: 'application/json' }
        }).then(function (res) { return res.ok ? res.json() : null; }).then(function (data) {
          // The public JSON must describe the product Liquid signed.
          if (!data || String(data.id) !== signed.productId || !Array.isArray(data.variants)) return false;
          productJson = data;
          return !!adapter.detectProduct();
        }).catch(function () { return false; }));
      },

      placementTarget: function () {
        if (platform === 'shopify') return shopifyForm();
        return document.querySelector('button[name="add-to-cart"],button[name="add"],[data-add-to-cart],.single_add_to_cart_button') ||
          document.querySelector('[data-grindctrl-tryon]');
      },

      /* Product cards that link to a signed product and have no pill yet:
         { host, productId, title }. The pill goes in the image's container,
         outside the product link, as in the Shopify app's catalog embed. */
      findCards: function (rescan) {
        var found = [];
        var claimed = [];
        var unsigned = false;
        var anchors = document.querySelectorAll('a[href*="/products/"]');
        for (var i = 0; i < anchors.length; i++) {
          var link = anchors[i];
          if (link.closest('.gc-tryon-sheet, .gc-cat-overlay, nav, header, footer')) continue;
          var handle = productHandle(link.getAttribute('href'));
          if (!handle) continue;
          var card = link.closest(CARD) || link.parentElement;
          if (!card || claimed.indexOf(card) !== -1 || card.querySelector('.gc-tryon-pill, .gc-cat-btn')) continue;
          var img = card.querySelector('img');
          // Skip the product page's own main content.
          if (!img || card.closest('.product, product-info, [id^="MainProduct"]')) continue;
          var entry = cardsByHandle[handle];
          if (!entry) { unsigned = true; continue; }
          claimed.push(card);
          var imageLink = img.closest('a');
          found.push({ host: (imageLink && imageLink.parentElement) || img.parentElement || card, productId: entry.id, title: entry.title });
        }
        if (unsigned && typeof rescan === 'function') refreshCards(rescan);
        return found;
      },

      detectProduct: function (button) {
        if (button && button.dataset && button.dataset.gcCard === '1') {
          var card = cardsById[button.dataset.productId];
          return card ? { id: card.id, variantId: card.signed.variantId, title: card.title, imageUrl: card.imageUrl,
            price: null, currency: shopifyCurrency(), handle: card.handle, card: true } : null;
        }
        if (platform === 'website') return initialProduct;
        if (!productJson) return null;
        var form = shopifyForm();
        var field = form && form.querySelector('[name="id"]');
        // Re-read at every tap: the theme's own variant picker writes this field.
        var variant = findVariantIn(productJson, field && field.value) || findVariantIn(productJson, signed.variantId);
        if (!variant) return null;
        var photo = image(variant.featured_image && variant.featured_image.src) || image(productJson.featured_image) || image(productJson.images);
        if (!photo) return null;
        return { id: signed.productId, variantId: String(variant.id), title: String(productJson.title || '').slice(0, 200),
          imageUrl: photo, price: typeof variant.price === 'number' ? variant.price : null, currency: shopifyCurrency() };
      },

      getContext: function (product) {
        if (product.card) {
          var card = cardsById[product.id];
          if (!card) return Promise.reject(new Error('context_invalid'));
          if (usable(cardContexts[card.id])) return Promise.resolve(displayContext(cardContexts[card.id], product));
          if (!cardPending[card.id]) {
            cardPending[card.id] = requestContext(product, card.signed, function () { return refreshCardRender(card); }, false)
              .then(function (data) { cardContexts[card.id] = data; return data; });
            cardPending[card.id].then(function () { delete cardPending[card.id]; }, function () { delete cardPending[card.id]; });
          }
          return cardPending[card.id].then(function (data) { return displayContext(data, product); });
        }
        // One short-lived context serves prewarm, reopen and variant changes;
        // replaying the same Liquid render for this visitor is refused anyway.
        if (usable(context)) return Promise.resolve(displayContext(context, product));
        if (!pending) {
          pending = requestContext(product, signed, function () { return refreshSignedRender(product.variantId); }, false)
            .then(function (data) { context = data; return data; });
          pending.then(function () { pending = null; }, function () { pending = null; });
        }
        return pending.then(function (data) { return displayContext(data, product); });
      },

      getProduct: function (product) {
        if (product && product.card) {
          var card = cardsById[product.id];
          return card ? cardProductJson(card).then(function (json) { return json ? productOptions(json) : null; }) : Promise.resolve(null);
        }
        return Promise.resolve(productJson ? productOptions(productJson) : null);
      },

      addToCart: function (variant, qty, state) {
        if (platform !== 'shopify') return Promise.resolve('unsupported');
        if (!Number.isInteger(qty) || qty < 1 || qty > 99) return Promise.resolve({ ok: false });
        var product = state && state.product;
        var card = product && product.card ? cardsById[product.id] : null;
        var source = card ? cardProductJson(card) : Promise.resolve(productJson);
        return source.then(function (json) {
          // Only a variant of this product, whatever the sheet asks for.
          var chosen = findVariantIn(json, variant);
          if (!chosen) return { ok: false };
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
        });
      },

      // Only from the sheet's explicit Checkout tap.
      checkout: function () { if (platform === 'shopify') window.location.href = shopifyRoot() + 'cart'; }
    };
    return adapter;
  }

  window.GRINDCTRL_TRYON_PASTE = { version: '1.3.0', create: create, detectWebsiteProduct: websiteProduct };
})();
