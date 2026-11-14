/**
 * GRINDCTRL Try-On paste adapters v1.6.2 (website and Shopify paste installs).
 *
 * Loaded by messenger.js on pages of a `data-gc-install="paste"` snippet
 * that show a product or product cards, then mounted on the hosted engine
 * (tryon-engine.js). Everything read from the page is display or cart data;
 * the context minted by /api/try-on/paste-context is the only authority for
 * a look.
 *
 * Website pages (any stack) read the product from, first hit wins: JSON-LD
 * Product or ProductGroup, schema.org microdata, Open Graph product tags,
 * then the merchant's own tag, which is also where the button goes:
 *   <div data-grindctrl-tryon data-product-id="linen-dress"
 *        data-title="Linen dress" data-image="https://example.com/dress.jpg"></div>
 * Product cards on website listings come from JSON-LD ItemList entries
 * matched to the page's own product links, or from the merchant's card tag:
 *   <div data-grindctrl-card data-product-id="linen-dress" data-title="Linen dress"
 *        data-image="https://example.com/dress.jpg" data-url="/shop/linen-dress">...</div>
 *   data-product-id may be left out when data-url is given (its last path segment is used).
 *
 * Adapter contract (consumed by tryon-engine.js):
 *   detectProduct(button?)  -> { id, variantId, title, imageUrl, price, currency } | null
 *   getContext(product)     -> Promise<{ embedUrl, context: { expiresAt }, settings? }>
 *                              rejects with error.hidden = true when the store cannot
 *                              start a look; error.scope 'product' when only this
 *                              product cannot (its card pill goes, the rest stay)
 *   addToCart(variant, qty, state) -> Promise<{ ok, message?, variantTitle? } | 'unsupported'>
 *   placement()             -> { node, mode } where the injected button goes: after node,
 *                              or mode 'float' (a fixed pill, node null) | null
 *   placementTarget()       -> placement().node, for older callers
 *   injectButton            -> the product page button (after prepare)
 *   buttonSettings          -> its owner's look from /api/try-on/paste-config, null when unread
 *   injectCards, cardSettings, findCards(rescan), cardTrigger -> product card pills (after prepare)
 *   followsPage, refresh()  -> website only: re-read the page after a client-side change
 *
 * create() options: script, appOrigin, locale, visitorId, preview, and
 * onProven(), called once when this page's signed render confirmed a
 * Shopify store that was waiting for it (the loader then starts Store Chat).
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
  // A page image smaller than this is an icon, a swatch or a tracking pixel, never the garment.
  var MIN_IMAGE_PX = 200;
  // Nothing in these is the product page's own purchase area or gallery.
  var NOT_PRODUCT_AREA = 'header, nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"], dialog, ' +
    '[role="dialog"], [aria-modal="true"], cart-drawer, [class*="cart-drawer"], [class*="cart_drawer"], [id*="cart-drawer"], ' +
    '[id*="CartDrawer"], [class*="mini-cart"], [class*="minicart"], [class*="side-cart"], .gc-tryon-sheet';
  // (Not "ProductItem": Squarespace names its product page that.)
  var PRODUCT_CARD = '[data-grindctrl-card], .product-card, .product-item, [class*="product-card"], [class*="product-item"], ' +
    '[class*="ProductCard"], .card-wrapper, .grid__item';
  // Purchase buttons named by their markup on common stacks (WooCommerce, Shopify themes, Wix, Webflow, Squarespace).
  var BUY_MARKUP = 'button[name="add-to-cart"], button[name="add"], [data-add-to-cart], [data-hook="add-to-cart"], ' +
    '.add-to-cart, .add_to_cart, .single_add_to_cart_button, .product-form__submit, .btn-addtocart, .buy-now, ' +
    '.sqs-add-to-cart-button, .w-commerce-commerceaddtocartbutton';
  var BUY_CONTROLS = 'button, input[type="submit"], input[type="button"], [role="button"], a[href]';
  // Matched against a control's text, value, aria-label or name, normalized by buyText().
  var BUY_WORDS = ['add to cart', 'add to bag', 'add to basket', 'buy now', 'order now', 'أضف إلى السلة', 'اضف الى السلة',
    'أضف للسلة', 'اشتري الآن', 'اشتر الآن', 'اطلب الآن', 'اطلب الان', 'شراء الآن', 'اضغط هنا للشراء', 'للشراء'];
  // Only on a page that shows a product, and only when nothing better is there.
  var WEAK_BUY_WORDS = ['shop now'];

  function httpsUrl(value) {
    if (typeof value !== 'string' || !value) return '';
    try {
      var url = new URL(value, window.location.href);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }
  function imageCandidates(value) {
    return [].concat(value == null ? [] : value).map(function (entry) {
      if (entry && typeof entry === 'object') entry = entry.url || entry.contentUrl;
      return httpsUrl(entry);
    }).filter(Boolean);
  }
  // The server accepts garment images on the store's own domains; prefer one there when the data lists several.
  function pickImage(value) {
    var candidates = imageCandidates(value);
    var site = window.location.hostname.replace(/^www\./, '');
    for (var i = 0; i < candidates.length; i++) {
      var host = new URL(candidates[i]).hostname;
      if (host === site || host.slice(-(site.length + 1)) === '.' + site) return candidates[i];
    }
    return candidates[0] || '';
  }
  function image(value) {
    return imageCandidates(value)[0] || '';
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
    // Hosted stores may omit every identifier in Product JSON-LD. Prefer
    // their canonical product URL, falling back to the current SPA route.
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      try {
        var url = new URL(canonical.getAttribute('href'), window.location.href);
        if (url.origin === window.location.origin && /^\/products\/[^/]+\/?$/.test(url.pathname)) {
          return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop());
        }
      } catch (_) { /* invalid canonical: read the actual page */ }
    }
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

  /* ── Reading any website ─────────────────────────────────────────────── */

  // Case, spacing, separators and Arabic letter forms do not change what a label says.
  function buyText(value) {
    return String(value == null ? '' : value).replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  var STRONG = BUY_WORDS.map(buyText);
  var WEAK = WEAK_BUY_WORDS.map(buyText);

  function jsonLdNodes() {
    var nodes = [];
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < scripts.length; i++) {
      try { nodes.push(JSON.parse(scripts[i].textContent)); } catch (_) { /* one broken block does not hide the rest */ }
    }
    return nodes;
  }
  function typed(node, pattern) {
    return [].concat(node['@type'] || []).some(function (type) { return pattern.test(String(type)); });
  }
  function offersOf(node) {
    var offers = node && node.offers;
    if (offers && !Array.isArray(offers) && Array.isArray(offers.offers)) offers = offers.offers;
    return [].concat(offers || []).filter(function (offer) { return offer && typeof offer === 'object'; });
  }
  function variantParam(url) {
    // No address is no variant (an empty one would resolve to this page's own).
    if (typeof url !== 'string' || !url) return '';
    try { return new URL(url, window.location.href).searchParams.get('variant') || ''; } catch (_) { return ''; }
  }
  // Display data only (the sheet's selected variant, a prewarm key): never sent as a signed claim.
  function variantKey(node) {
    var value = String(node.sku || node.productID || variantParam(node.url) || '').trim();
    return /^[A-Za-z0-9._:-]{1,100}$/.test(value) ? value : '';
  }

  function visible(element) {
    for (var node = element; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hidden) return false;
      var style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    var box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  }
  // A fixed or sticky bar (a sticky buy bar, a chat bubble) is not a place in the page's flow.
  function pinned(element) {
    for (var node = element; node && node.nodeType === 1 && node !== document.body; node = node.parentElement) {
      var position = window.getComputedStyle(node).position;
      if (position === 'fixed' || position === 'sticky') return true;
    }
    return false;
  }
  /* naturalWidth is density-corrected (srcset w descriptors, sizes="auto"): a
     600px product photo shown at 154 CSS px on a 3x phone reads as 154, which
     dropped every card on phones. The photo's own size is what tells a product
     image from an icon, so take the largest of what the browser, the markup
     and the screen say. */
  function imageSize(img) {
    var ratio = window.devicePixelRatio || 1;
    var box = img.getBoundingClientRect();
    var width = Math.max(img.naturalWidth || 0, Number(img.getAttribute('width')) || 0, Math.round(box.width * ratio));
    var height = Math.max(img.naturalHeight || 0, Number(img.getAttribute('height')) || 0, Math.round(box.height * ratio));
    return width >= MIN_IMAGE_PX && height >= MIN_IMAGE_PX ? width * height : 0;
  }
  function firstTitle() {
    var titles = document.querySelectorAll('h1');
    for (var i = 0; i < titles.length; i++) {
      if (!titles[i].closest(NOT_PRODUCT_AREA + ', ' + PRODUCT_CARD) && visible(titles[i])) return titles[i];
    }
    return null;
  }
  // Where this product's gallery and purchase controls live.
  function productArea() {
    var scoped = document.querySelector('[itemscope][itemtype*="schema.org/Product"]');
    if (scoped) return scoped;
    var title = firstTitle();
    for (var node = title && title.parentElement, depth = 0; node && depth < 5; node = node.parentElement, depth++) {
      if (node === document.body) break;
      if (node.querySelector('img')) return node;
    }
    return document.querySelector('main, [role="main"]') || document.body;
  }
  // og:image first, then the largest real image in the product area.
  function pageImage() {
    var og = httpsUrl(meta('og:image'));
    if (og) return og;
    var best = '';
    var bestSize = 0;
    var images = productArea().querySelectorAll('img');
    for (var i = 0; i < images.length; i++) {
      var img = images[i];
      if (img.closest(NOT_PRODUCT_AREA + ', ' + PRODUCT_CARD)) continue;
      var size = imageSize(img);
      var src = httpsUrl(img.currentSrc || img.getAttribute('src'));
      if (size > bestSize && src && visible(img)) { best = src; bestSize = size; }
    }
    return best;
  }

  /* The options the shopper picked on the page (selects, radios, pressed
     swatches), to follow a variant the structured data lists. */
  function chosenOptions() {
    var area = productArea();
    var values = [];
    function add(value) { value = buyText(value); if (value) values.push(value); }
    Array.prototype.forEach.call(area.querySelectorAll('select'), function (select) {
      var option = select.options[select.selectedIndex];
      if (option && option.value) { add(option.value); add(option.textContent); }
    });
    Array.prototype.forEach.call(area.querySelectorAll('input[type="radio"]:checked'), function (input) {
      add(input.value);
      if (input.labels && input.labels[0]) add(input.labels[0].textContent);
    });
    Array.prototype.forEach.call(area.querySelectorAll('[aria-checked="true"], [aria-pressed="true"]'), function (node) {
      add(node.getAttribute('data-value'));
      add(node.textContent);
    });
    return values;
  }
  function optionValues(node) {
    var values = [];
    ['color', 'size', 'material', 'pattern'].forEach(function (name) {
      if (typeof node[name] === 'string' && node[name].trim()) values.push(buyText(node[name]));
    });
    [].concat(node.additionalProperty || []).forEach(function (property) {
      if (property && typeof property.value === 'string' && property.value.trim()) values.push(buyText(property.value));
    });
    return values;
  }
  /* The variant the page has selected: its ?variant= address, else the one
     variant whose options all match the shopper's choices. Null otherwise. */
  function selectedVariant(variants) {
    var wanted = variantParam(window.location.search);
    if (wanted) {
      for (var i = 0; i < variants.length; i++) {
        var node = variants[i];
        var offer = offersOf(node)[0] || {};
        if ([node.sku, node.productID, variantParam(node.url), variantParam(offer.url), offer.sku]
          .some(function (value) { return value != null && String(value) === wanted; })) return node;
      }
    }
    var chosen = chosenOptions();
    if (!chosen.length) return null;
    var matches = variants.filter(function (node) {
      var values = optionValues(node);
      return values.length > 0 && values.every(function (value) { return chosen.indexOf(value) !== -1; });
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function productFrom(node, selected) {
    var source = selected || node;
    var offer = offersOf(source)[0] || offersOf(node)[0] || {};
    // A stable SKU or the page slug. Never an array index.
    var id = productId(node.productGroupID || node.productID || node.sku || node.mpn) || productId(pathSlug());
    if (!id) return null;
    var photo = pickImage(source.image) || pickImage(node.image) || pageImage();
    if (!photo) return null;
    var price = offer.price != null ? offer.price : offer.lowPrice;
    var heading = firstTitle();
    var title = String(node.name || source.name || meta('og:title') || (heading && heading.textContent) || '').replace(/\s+/g, ' ').trim();
    return { id: id, variantId: selected ? variantKey(selected) || null : null, title: title.slice(0, 200), imageUrl: photo,
      price: price != null && price !== '' ? price : null, currency: offer.priceCurrency || null,
      description: String(source.description || node.description || meta('og:description') || '').replace(/<[^>]*>/g, ' ').slice(0, 600),
      availability: /(?:^|\/)InStock$/i.test(String(offer.availability || '')) ? 'in_stock' : /(?:^|\/)(OutOfStock|SoldOut)$/i.test(String(offer.availability || '')) ? 'out_of_stock' : 'unknown',
      sizes: [].concat(node.sizes || source.size || node.size || []).slice(0, 30).map(function (size) { return String(size && size.name || size).slice(0, 80); }) };
  }

  /* JSON-LD: arrays, @graph, mainEntity, ProductGroup.hasVariant and
     per-variant offers. A group's own id stays the product id. */
  function jsonLdProduct() {
    function fromGroup(node) {
      var variants = [].concat(node.hasVariant || []).filter(function (entry) { return entry && typeof entry === 'object'; });
      if (!variants.length) return productFrom(node, null);
      var selected = selectedVariant(variants);
      var base = selected || variants[0];
      // The group's id, else its first variant's: the same id whichever variant is picked.
      var merged = { productGroupID: node.productGroupID || node.sku || node.productID ||
          variants[0].productID || variants[0].sku || variants[0].mpn,
        name: node.name || base.name, description: node.description || base.description,
        sizes: variants.map(function (variant) { return variant.size || variant.name || ''; }),
        image: [].concat(selected ? selected.image || [] : [], node.image || [], base.image || []),
        offers: offersOf(base).length ? offersOf(base) : offersOf(node) };
      return productFrom(merged, selected);
    }
    function fromProduct(node) {
      var withSku = offersOf(node).filter(function (offer) { return offer.sku || variantParam(offer.url); });
      var selected = withSku.length > 1 ? selectedVariant(withSku) : null;
      return productFrom(node, selected);
    }
    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 6) return null;
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) { var found = walk(node[i], depth + 1); if (found) return found; }
        return null;
      }
      var product = typed(node, /(^|[/#])ProductGroup$/) ? fromGroup(node) : typed(node, /(^|[/#])Product$/) ? fromProduct(node) : null;
      return product || walk(node['@graph'], depth + 1) || walk(node.mainEntity, depth + 1) || walk(node.hasVariant, depth + 1);
    }
    return walk(jsonLdNodes(), 0);
  }

  /* schema.org microdata: an itemscope Product and its own itemprops, with
     nested Offer scopes for the price. */
  function microdataProduct() {
    function value(element) {
      if (element.hasAttribute('content')) return element.getAttribute('content');
      var tag = element.tagName;
      if (tag === 'IMG' || tag === 'SOURCE') return element.getAttribute('src') || '';
      if (tag === 'A' || tag === 'LINK') return element.getAttribute('href') || '';
      if (tag === 'DATA' || tag === 'METER') return element.getAttribute('value') || '';
      return element.textContent || '';
    }
    function props(scope) {
      var out = {};
      var nodes = scope.querySelectorAll('[itemprop]');
      for (var i = 0; i < nodes.length; i++) {
        var element = nodes[i];
        if ((element.parentElement && element.parentElement.closest('[itemscope]')) !== scope) continue;
        var read = element.hasAttribute('itemscope') ? props(element) : String(value(element)).trim();
        element.getAttribute('itemprop').split(/\s+/).forEach(function (name) {
          if (name) (out[name] = out[name] || []).push(read);
        });
      }
      return out;
    }
    var scopes = document.querySelectorAll('[itemscope][itemtype]');
    for (var i = 0; i < scopes.length; i++) {
      if (!/schema\.org\/Product(\s|$)/.test(scopes[i].getAttribute('itemtype'))) continue;
      var p = props(scopes[i]);
      var first = function (name) { var list = p[name] || []; return typeof list[0] === 'string' ? list[0] : ''; };
      var product = productFrom({ name: first('name'), description: first('description'), size: first('size'), sku: first('sku'), productID: first('productID'), mpn: first('mpn'),
        image: (p.image || []).filter(function (entry) { return typeof entry === 'string'; }),
        offers: (p.offers || []).filter(function (offer) { return offer && typeof offer === 'object'; }).map(function (offer) {
          return { price: (offer.price || [])[0], lowPrice: (offer.lowPrice || [])[0], priceCurrency: (offer.priceCurrency || [])[0], availability: (offer.availability || [])[0] };
        }) }, null);
      if (product) return product;
    }
    return null;
  }

  function openGraphProduct() {
    if (!meta('product:retailer_item_id') && !meta('product:price:amount') && !/^(product|og:product)$/.test(meta('og:type'))) return null;
    return productFrom({ productID: meta('product:retailer_item_id'), name: meta('og:title'), image: meta('og:image'), description: meta('og:description'),
      offers: { price: meta('product:price:amount'), priceCurrency: meta('product:price:currency'), availability: meta('product:availability') } }, null);
  }

  function tagProduct() {
    var tag = document.querySelector('[data-grindctrl-tryon][data-product-id]');
    return tag ? productFrom({ productID: tag.dataset.productId, name: tag.dataset.title, image: tag.dataset.image }, null) : null;
  }

  function websiteProduct() {
    return jsonLdProduct() || microdataProduct() || openGraphProduct() || tagProduct();
  }

  /* Woo's own page markers, never its address. The page's cart form owns
     the allowed product/variation ids, just as in the plugin adapter. */
  function wooPage() {
    var form = document.querySelector('form.cart');
    return !!(window.woocommerce_params || window.wc_add_to_cart_params ||
      (form && (form.matches('.variations_form') || form.querySelector('.single_add_to_cart_button'))));
  }
  function wooProduct(product) {
    if (!product || product.card) return null;
    var form = document.querySelector('form.cart');
    if (!form || !(window.woocommerce_params || window.wc_add_to_cart_params ||
        form.matches('.variations_form') || form.querySelector('.single_add_to_cart_button'))) return null;
    var page = websiteProduct();
    if (!page || page.id !== product.id) return null;
    var field = form.querySelector('[name="product_id"], [name="add-to-cart"]');
    var id = form.getAttribute('data-product_id') || (field && field.value);
    if (!/^[1-9]\d{0,15}$/.test(String(id || ''))) return null;
    var selected = form.querySelector('[name="variation_id"]');
    var attributes = [];
    Array.prototype.forEach.call(form.querySelectorAll('[name^="attribute_"]'), function (input) {
      if (input.value) attributes.push({ attribute: input.name.replace(/^attribute_/, ''), value: input.value });
    });
    var variations = [];
    try { variations = JSON.parse(form.getAttribute('data-product_variations') || '[]'); } catch (_) {}
    if (!Array.isArray(variations)) variations = [];
    var variable = form.matches('.variations_form');
    var variants = variations.filter(function (v) { return v && /^[1-9]\d{0,15}$/.test(String(v.variation_id)); }).map(function (v) {
      var attrs = Object.keys(v.attributes || {}).map(function (key) {
        var name = key.replace(/^attribute_/, '');
        var current = attributes.filter(function (a) { return a.attribute === name; })[0];
        return { attribute: name, value: v.attributes[key] || (current && current.value) || '' };
      });
      return { id: String(v.variation_id), title: attrs.map(function (a) { return a.value; }).join(' / '),
        options: attrs.map(function (a) { return a.value; }), attributes: attrs, available: v.is_in_stock !== false && v.is_purchasable !== false,
        price: typeof v.display_price === 'number' ? Math.round(v.display_price * 100) : null };
    });
    var picked = selected && /^[1-9]\d{0,15}$/.test(selected.value) ? selected.value : null;
    // Large variable products use Woo's AJAX picker instead of a printed list.
    if (variable && !variants.length && picked) variants.push({ id: picked, title: attributes.map(function (a) { return a.value; }).join(' / '),
      options: attributes.map(function (a) { return a.value; }), attributes: attributes, available: true, price: null });
    if (!variable) variants = [{ id: String(id), title: 'Default Title', options: [], attributes: [], available: true, price: null }];
    return { id: String(id), variantId: variable ? picked : String(id), variants: variants, options: attributes.map(function (a) { return a.attribute; }), currency: page.currency };
  }

  var wooNonce = '';
  function wooApi(path, body) {
    var link = document.querySelector('link[rel="https://api.w.org/"]');
    var root = (window.wpApiSettings && window.wpApiSettings.root) || (link && link.href) || '/wp-json/';
    var url = new URL(root, window.location.href);
    if (url.origin !== window.location.origin) return Promise.reject(new Error('cart_origin'));
    if (url.searchParams.has('rest_route')) url.searchParams.set('rest_route', '/wc/store/v1/' + path);
    else url = new URL('wc/store/v1/' + path, url);
    var headers = { Accept: 'application/json' };
    if (wooNonce) headers.Nonce = wooNonce;
    if (body) headers['Content-Type'] = 'application/json';
    return fetch(url.href, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: headers, body: body }).then(function (res) {
      var nonce = res.headers.get('Nonce');
      if (nonce) wooNonce = nonce;
      return res;
    });
  }

  function wooAdd(variant, qty, state) {
    var product = wooProduct(state && state.product);
    if (!product) return Promise.resolve('unsupported');
    if (typeof qty !== 'number' || qty % 1 !== 0 || qty < 1 || qty > 99) return Promise.resolve({ ok: false });
    var chosen = product.variants.filter(function (v) { return v.id === String(variant); })[0];
    if (!chosen || !chosen.available || chosen.attributes.some(function (a) { return !a.value; })) return Promise.resolve({ ok: false });
    var payload = { id: Number(chosen.id), quantity: qty };
    if (chosen.attributes.length) payload.variation = chosen.attributes;
    function add() { return wooApi('cart/add-item', JSON.stringify(payload)); }
    return (wooNonce ? Promise.resolve() : wooApi('cart')).then(add).then(function (res) {
      return res.status === 401 || res.status === 403 ? wooApi('cart').then(add) : res;
    }).then(function (res) {
      if (!res.ok) return { ok: false };
      try {
        if (window.jQuery) window.jQuery(document.body).trigger('wc_fragment_refresh');
        document.body.dispatchEvent(new CustomEvent('wc-blocks_added_to_cart', { bubbles: true, detail: { preserveCartData: false } }));
      } catch (_) {}
      return { ok: true, variantTitle: chosen.title };
    });
  }

  /* ── Where the website button goes ───────────────────────────────────── */

  function manualSpot() {
    var tag = document.querySelector('body [data-grindctrl-tryon]');
    if (!tag) return null;
    var style = window.getComputedStyle(tag);
    return tag.hidden || style.display === 'none' || style.visibility === 'hidden' ? null : tag;
  }
  function buyScore(control) {
    var labels = [control.textContent, control.value, control.getAttribute('aria-label'), control.getAttribute('name')];
    var weak = false;
    for (var i = 0; i < labels.length; i++) {
      var label = buyText(labels[i]);
      if (!label || label.length > 60) continue;
      // "Order" alone is too broad on links and generic clickable cards.
      if (control.tagName === 'BUTTON' && label === buyText('اطلب')) return 0;
      if (STRONG.some(function (word) { return label.indexOf(word) !== -1; })) return 0;
      if (WEAK.some(function (word) { return label.indexOf(word) !== -1; })) weak = true;
    }
    // A plain link says "shop now" everywhere; only a button-like one counts.
    return weak && !(control.tagName === 'A' && !control.matches('[role="button"]')) ? 1 : -1;
  }
  function purchaseControl() {
    var best = null;
    var bestScore = 2;
    function consider(control, score) {
      if (score < 0 || score >= bestScore || control.closest(NOT_PRODUCT_AREA + ', ' + PRODUCT_CARD) ||
          pinned(control) || !visible(control)) return;
      best = control;
      bestScore = score;
    }
    var named = document.querySelectorAll(BUY_MARKUP);
    for (var i = 0; i < named.length && bestScore > 0; i++) consider(named[i], 0);
    var forms = document.querySelectorAll('form[action*="/cart"]');
    for (var j = 0; j < forms.length && bestScore > 0; j++) {
      consider(forms[j].querySelector('button[type="submit"], button:not([type]), input[type="submit"]') || forms[j], 0);
    }
    var controls = document.querySelectorAll(BUY_CONTROLS);
    for (var k = 0; k < controls.length && bestScore > 0; k++) consider(controls[k], buyScore(controls[k]));
    return best;
  }
  /* After the purchase button's nearest block-level wrapper (its row with
     the quantity picker, its form), or right after the button when that
     wrapper is the whole product section. */
  function afterPurchase(control) {
    var node = control.parentElement;
    while (node && node !== document.body && /^(inline|contents)/.test(window.getComputedStyle(node).display)) node = node.parentElement;
    if (!node || node === document.body || node.matches('main, [role="main"]') || node.querySelector('h1, img')) return control;
    return node;
  }
  // After the product title, or after a price right below it.
  function titleSpot() {
    var title = firstTitle();
    if (!title) return null;
    var next = title.nextElementSibling;
    for (var i = 0; next && i < 3; i++, next = next.nextElementSibling) {
      if (next.matches('[itemprop="price"], [itemprop="offers"], [class*="price"], [class*="Price"], [data-price]') ||
          next.querySelector('[itemprop="price"]')) return next;
    }
    return title;
  }
  function websitePlacement() {
    var tag = manualSpot();
    if (tag) return { node: tag, mode: 'tag' };
    var control = purchaseControl();
    if (control) return { node: afterPurchase(control), mode: 'purchase' };
    var title = titleSpot();
    if (title) return { node: title, mode: 'title' };
    return { node: null, mode: 'float' };
  }

  /* ── Website product cards ───────────────────────────────────────────── */

  // Same-origin page address without query or hash, the key a card link and an ItemList entry share.
  function pageKey(href) {
    try {
      var url = new URL(String(href || ''), window.location.href);
      if (url.origin !== window.location.origin) return '';
      return url.origin + (url.pathname.replace(/\/+$/, '') || '/');
    } catch (_) { return ''; }
  }
  function slugOf(key) {
    try { return decodeURIComponent(new URL(key).pathname.split('/').filter(Boolean).pop() || ''); } catch (_) { return ''; }
  }
  function itemListEntries() {
    // EasyOrders' onClick-only collection cards have no links or ItemList.
    // Leave them without pills; its server product-list adapter will supply cards later.
    var entries = [];
    var seen = {};
    function add(element) {
      if (!element || typeof element !== 'object' || entries.length >= CARD_LIMIT) return;
      var item = element.item && typeof element.item === 'object' ? element.item : element;
      var key = pageKey(element.url || item.url || (typeof element.item === 'string' ? element.item : ''));
      if (!key || seen[key]) return;
      var id = productId(item.sku || item.productID) || productId(slugOf(key));
      if (!id) return;
      seen[key] = true;
      entries.push({ id: id, key: key, title: String(item.name || element.name || '').trim().slice(0, 200),
        imageUrl: pickImage(item.image || element.image) });
    }
    function walk(node, depth) {
      if (!node || typeof node !== 'object' || depth > 6) return;
      if (Array.isArray(node)) { node.forEach(function (entry) { walk(entry, depth + 1); }); return; }
      if (typed(node, /(^|[/#])ItemList$/) && Array.isArray(node.itemListElement)) node.itemListElement.forEach(add);
      walk(node['@graph'], depth + 1);
      walk(node.mainEntity, depth + 1);
    }
    walk(jsonLdNodes(), 0);
    return entries;
  }
  function cardPhoto(card) {
    var best = '';
    var bestSize = 0;
    var images = card.querySelectorAll('img');
    for (var i = 0; i < images.length; i++) {
      var size = imageSize(images[i]);
      var src = httpsUrl(images[i].currentSrc || images[i].getAttribute('src'));
      if (size > bestSize && src) { best = src; bestSize = size; }
    }
    return best;
  }
  /* The card around a product link: its nearest ancestor that also holds an
     image, unless that ancestor already holds another listed product (the
     grid). A link around the image is the card only when nothing above it
     is, so the pill can sit beside the link rather than inside it. */
  function cardAround(link, entriesByKey, key) {
    var imageLink = null;
    for (var node = link, depth = 0; node && depth < 8; node = node.parentElement, depth++) {
      if (node === document.body || node.matches('main, [role="main"]')) return imageLink;
      if (!node.querySelector('img')) continue;
      var links = node.querySelectorAll('a[href]');
      for (var i = 0; i < links.length; i++) {
        var other = pageKey(links[i].getAttribute('href'));
        if (other && other !== key && entriesByKey[other]) return imageLink;
      }
      if (node.tagName !== 'A') return node;
      imageLink = node;
    }
    return imageLink;
  }
  // The pill sits over the card image, outside a link around it where there is one.
  function pillHost(card) {
    var img = card.querySelector('img');
    if (!img) return card;
    var imageLink = img.closest('a');
    var host = imageLink && imageLink !== card && card.contains(imageLink) ? imageLink.parentElement : img.parentElement;
    if (host && host.tagName === 'PICTURE') host = host.parentElement;
    return host && card.contains(host) ? host : card;
  }

  /* The product's own add-to-cart form. Themes also render other /cart/add
     forms first, such as Shop Pay's hidden installments form, so take the
     first one that is shown and has a submit button, outside product cards;
     else the first outside cards, which still carries the variant field. */
  function shopifyForm() {
    var forms = document.querySelectorAll('form[action*="/cart/add"]');
    var fallback = null;
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      if (form.closest(PRODUCT_CARD)) continue;
      if (!fallback) fallback = form;
      if (visible(form) && form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]')) return form;
    }
    return fallback;
  }
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
    // Website pages: the config read at prepare, and one context per product and garment image.
    var websiteConfig;
    var websiteContexts = {};
    var websitePending = {};

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
      if (platform === 'website' && !wooProduct(product)) url.searchParams.set('cart', 'unsupported');
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

    /* Website cards: the merchant's card tags, then JSON-LD ItemList entries
       matched to the page's own product links. Unsigned, like the website
       product button: paste-context checks the page origin and the garment
       image host for both. */
    function websiteCards() {
      var found = [];
      var claimed = [];
      function remember(card) {
        if (!cardsById[card.id] && Object.keys(cardsById).length >= CARD_LIMIT) return false;
        cardsById[card.id] = card;
        return true;
      }
      var tagged = document.querySelectorAll('[data-grindctrl-card]');
      for (var i = 0; i < tagged.length && found.length < CARD_LIMIT; i++) {
        var node = tagged[i];
        if (node.closest('.gc-tryon-sheet') || node.querySelector('.gc-tryon-pill')) continue;
        var key = pageKey(node.dataset.url);
        var id = productId(node.dataset.productId) || (key ? productId(slugOf(key)) : '');
        var photo = pickImage(node.dataset.image) || cardPhoto(node);
        if (!id || !photo || !remember({ id: id, title: String(node.dataset.title || '').trim().slice(0, 200), imageUrl: photo })) continue;
        claimed.push(node);
        found.push({ host: pillHost(node), productId: id, title: cardsById[id].title });
      }
      // Woo's own runtime/form markers establish the platform, never /shop/ in the URL.
      // Explicit merchant tags take precedence over platform discovery.
      if (!tagged.length && wooPage()) {
        var loops = document.querySelectorAll('li.product, .wc-block-grid__product, .wc-block-product');
        for (var w = 0; w < loops.length && found.length < CARD_LIMIT; w++) {
          var loop = loops[w];
          if (loop.closest('.gc-tryon-sheet') || loop.querySelector('.gc-tryon-pill')) continue;
          // Classic loops print Add to cart as a link, block themes as a button.
          var cart = loop.querySelector('.add_to_cart_button[data-product_id]');
          var postId = /(?:^|\s)post-(\d+)(?:\s|$)/.exec(loop.className || '');
          var wooId = productId(cart ? cart.getAttribute('data-product_id') : postId && postId[1]);
          var permalink = loop.querySelector('a.woocommerce-LoopProduct-link, a.wc-block-grid__product-link, .wc-block-components-product-name a, a.wc-block-components-product-name, .wp-block-post-title a');
          if (!permalink) {
            var candidates = loop.querySelectorAll('a[href]');
            for (var c = 0; c < candidates.length; c++) {
              if (!candidates[c].matches('.add_to_cart_button, .added_to_cart') && !/[?&]add-to-cart=/.test(candidates[c].getAttribute('href'))) {
                permalink = candidates[c]; break;
              }
            }
          }
          var wooHref = permalink && permalink.getAttribute('href');
          var wooKey = wooHref && pageKey(wooHref);
          var wooPhoto = cardPhoto(loop);
          var titleNode = loop.querySelector('.woocommerce-loop-product__title, .wc-block-grid__product-title, .wc-block-components-product-name, .wp-block-post-title');
          var img = loop.querySelector('img');
          var wooTitle = String((titleNode && titleNode.textContent) || (img && img.getAttribute('alt')) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
          if (!wooId || !wooKey || !wooPhoto || claimed.some(function (other) { return other.contains(loop) || loop.contains(other); }) ||
              !remember({ id: wooId, title: wooTitle, imageUrl: wooPhoto, url: wooKey })) continue;
          claimed.push(loop);
          found.push({ host: pillHost(loop), productId: wooId, title: wooTitle });
        }
      }
      var entries = itemListEntries();
      if (!entries.length) return found;
      var byKey = {};
      entries.forEach(function (entry) { byKey[entry.key] = entry; });
      var links = document.querySelectorAll('a[href]');
      for (var j = 0; j < links.length && found.length < CARD_LIMIT; j++) {
        var link = links[j];
        var linkKey = pageKey(link.getAttribute('href'));
        var entry = linkKey && byKey[linkKey];
        if (!entry || link.closest(NOT_PRODUCT_AREA)) continue;
        var card = cardAround(link, byKey, linkKey);
        if (!card || claimed.some(function (other) { return other === card || other.contains(card) || card.contains(other); }) ||
            card.querySelector('.gc-tryon-pill, .gc-cat-btn')) continue;
        var cardImage = entry.imageUrl || cardPhoto(card);
        var title = entry.title || String(link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        if (!cardImage || !remember({ id: entry.id, title: title, imageUrl: cardImage })) continue;
        claimed.push(card);
        found.push({ host: pillHost(card), productId: entry.id, title: title });
      }
      return found;
    }
    function hasWebsiteCards() {
      return !!document.querySelector('[data-grindctrl-card]') || wooPage() || itemListEntries().length > 0;
    }
    function websiteContext(product) {
      var key = (product.card ? 'card:' : 'page:') + product.id + '|' + product.imageUrl;
      if (usable(websiteContexts[key])) return Promise.resolve(displayContext(websiteContexts[key], product));
      if (!websitePending[key]) {
        websitePending[key] = requestContext(product, null, null, false).then(function (data) { websiteContexts[key] = data; return data; });
        websitePending[key].then(function () { delete websitePending[key]; }, function () { delete websitePending[key]; });
      }
      return websitePending[key].then(function (data) { return displayContext(data, product); });
    }

    /* The product button, as the Shopify app block: nothing until the config
       answers, nothing when it says hidden, the owner's look from the first
       paint when it says live. A config that cannot be read keeps the
       default look; paste-context still decides at prewarm or tap. */
    function prepareButton(found) {
      return Promise.all([found, readPasteConfig()]).then(function (results) {
        var config = results[1];
        if (!results[0]) return false;
        if (config && config.tryOn !== 'live') return config.reason === 'shop_proof_pending' && platform === 'shopify' ? proveShop() : false;
        adapter.buttonSettings = config;
        adapter.injectButton = true;
        return true;
      });
    }

    /* A store not confirmed yet: this page's signed render is the proof's
       second factor, and nothing else sends it. One request through the
       ordinary context path; the server finishes the proof (it has also
       found the code on the storefront) or refuses with shop_proof_pending.
       Only a returned context shows the button, kept for the shopper's tap,
       so an unconfirmed store never shows one. No retry on this page. */
    function proveShop() {
      var product = adapter.detectProduct();
      if (!product) return false;
      return adapter.getContext(product).then(function (data) {
        adapter.buttonSettings = data.settings || null;
        adapter.injectButton = true;
        if (typeof options.onProven === 'function') {
          try { options.onProven(); } catch (_) { /* the loader's own business */ }
        }
        return true;
      }, function () { return false; });
    }

    function productPageHint() {
      if (/\/(products?|item)\/[^/]+/.test(window.location.pathname)) return true;
      return Array.prototype.some.call(document.querySelectorAll(BUY_MARKUP), function (button) {
        return !button.closest(NOT_PRODUCT_AREA + ', ' + PRODUCT_CARD);
      });
    }

    var adapter = {
      signalKey: script.dataset.key,
      productMissing: false,
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
      // Website pages change under client-side routers; messenger.js calls refresh() and the engine re-places.
      followsPage: platform === 'website',
      // New markup that may bring cards for the pill observer to look at.
      cardTrigger: platform === 'website' ? 'a[href], [data-grindctrl-card]' : 'a[href*="/products/"]',

      prepare: function () {
        if (platform === 'website') {
          // Nothing is asked of the server on a page with no product and no cards.
          // Only a recognisable product-page address/purchase area can report
          // missing data. An ordinary content page is not a broken product.
          var detectedProduct = websiteProduct();
          adapter.productMissing = !detectedProduct && productPageHint();
          if (!detectedProduct && !adapter.productMissing && !hasWebsiteCards()) return Promise.resolve(false);
          return readPasteConfig().then(function (config) {
            websiteConfig = config;
            return adapter.refresh();
          });
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

      /* Website: whether this page shows a product (the button) or, failing
         that, product cards (pills, when their switch is on). The config read
         at prepare decides; one that could not be read keeps the default
         button, as on Shopify, and adds no pills. */
      refresh: function () {
        if (platform !== 'website') return adapter.injectButton || adapter.injectCards || adapter.productMissing;
        if (websiteConfig === undefined) return false;
        var live = !websiteConfig || websiteConfig.tryOn === 'live';
        var product = live ? websiteProduct() : null;
        adapter.buttonSettings = websiteConfig;
        adapter.productMissing = live && !product && productPageHint();
        adapter.injectButton = !!product;
        adapter.injectCards = !product && !adapter.productMissing && !!websiteConfig && websiteConfig.tryOn === 'live' && websiteConfig.showCardPill === true && hasWebsiteCards();
        adapter.cardSettings = adapter.injectCards ? websiteConfig : null;
        return adapter.injectButton || adapter.injectCards || adapter.productMissing;
      },

      placement: function () {
        if (platform === 'shopify') {
          var form = shopifyForm();
          return form ? { node: form, mode: 'form' } : null;
        }
        return websitePlacement();
      },
      placementTarget: function () {
        var spot = adapter.placement();
        return spot ? spot.node : null;
      },

      /* Product cards that link to a signed product and have no pill yet:
         { host, productId, title }. The pill goes in the image's container,
         outside the product link, as in the Shopify app's catalog embed. */
      findCards: function (rescan) {
        if (platform === 'website') return websiteCards();
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
          if (card && platform === 'website') {
            return { id: card.id, variantId: null, title: card.title, imageUrl: card.imageUrl, price: null, currency: null, card: true };
          }
          return card ? { id: card.id, variantId: card.signed.variantId, title: card.title, imageUrl: card.imageUrl,
            price: null, currency: shopifyCurrency(), handle: card.handle, card: true } : null;
        }
        // Read again at every call: the page's own variant picker, or a client-side route, may have changed it.
        if (platform === 'website') {
          var page = websiteProduct();
          var woo = wooProduct(page);
          if (woo) page.variantId = woo.variantId;
          return page;
        }
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
        if (platform === 'website') return websiteContext(product);
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
        if (platform === 'website') {
          var woo = wooProduct(product);
          return Promise.resolve(woo ? { options: woo.options, variants: woo.variants, currency: woo.currency } : null);
        }
        if (product && product.card) {
          var card = cardsById[product.id];
          return card ? cardProductJson(card).then(function (json) { return json ? productOptions(json) : null; }) : Promise.resolve(null);
        }
        return Promise.resolve(productJson ? productOptions(productJson) : null);
      },

      addToCart: function (variant, qty, state) {
        if (platform !== 'shopify') return wooAdd(variant, qty, state);
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
      checkout: function () {
        if (platform === 'shopify') { window.location.href = shopifyRoot() + 'cart'; return; }
        if (!wooProduct(websiteProduct())) return;
        var params = window.wc_add_to_cart_params || window.woocommerce_params || {};
        var cart = params.cart_url || (document.querySelector('a.cart-contents') || {}).href;
        if (cart) {
          var url = new URL(cart, window.location.href);
          if (url.origin === window.location.origin) window.location.href = url.href;
        }
      }
    };
    return adapter;
  }

  window.GRINDCTRL_TRYON_PASTE = { version: '1.6.1', create: create, detectWebsiteProduct: websiteProduct };
})();
