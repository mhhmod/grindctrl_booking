/* GrindCTRL Try-On block: button styling comes from the GrindCTRL config
   API (dashboard-editable); clicking expands an iframe to the GrindCTRL
   embed inline. Height auto-syncs via postMessage from the embed. */
(function () {
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

  /* The v16 try-on sheet (02-try-on.md), for a store whose v16_tryon flag
     is on: a bottom sheet on phones and a centred dialog on desktop,
     instead of the iframe opening inline under the button. */
  var SHEET_COPY = {
    en: { close: 'Close' },
    ar: { close: 'إغلاق' }
  };

  function v16Sheet(cfg) {
    return !!(cfg && Array.isArray(cfg.features) && cfg.features.indexOf('v16_tryon') !== -1);
  }

  /* The variant the shopper picked with the theme's own selectors (item
     19), read at the tap from the product form beside the block. */
  function selectedVariant(root) {
    var scopes = [root.closest('.shopify-section'), document];
    for (var s = 0; s < scopes.length; s++) {
      if (!scopes[s]) continue;
      var forms = scopes[s].querySelectorAll('form[action*="/cart/add"]');
      for (var f = 0; f < forms.length; f++) {
        var input = forms[f].querySelector('[name="id"]');
        if (input && /^\d+$/.test(input.value)) return input.value;
      }
    }
    return root.dataset.variant || '';
  }

  /* The product as this page shows it, from the store's own product JSON
     in the shopper's language and currency: its options, and its variants
     with their names, availability and prices (item 19). The sheet shows
     them on the look; null when it cannot be read. */
  function fetchStoreProduct(root) {
    var handle = root.dataset.product || '';
    if (!handle) return Promise.resolve(null);
    var base = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return fetch(base + 'products/' + encodeURIComponent(handle) + '.js', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (product) {
        if (!product || !Array.isArray(product.variants)) return null;
        var options = (Array.isArray(product.options) ? product.options : []).map(function (option) {
          return typeof option === 'string' ? option : (option && option.name) || '';
        });
        var variants = product.variants.slice(0, 250).map(function (v) {
          return {
            id: v.id,
            title: v.title || '',
            options: [v.option1, v.option2, v.option3].filter(function (value) { return typeof value === 'string'; }),
            available: v.available === true,
            price: typeof v.price === 'number' ? v.price : null
          };
        });
        var currency = window.Shopify && window.Shopify.currency && window.Shopify.currency.active;
        return { options: options, variants: variants, currency: typeof currency === 'string' ? currency : null };
      })
      .catch(function () { return null; });
  }

  function findVariant(product, variantId) {
    var variants = (product && product.variants) || [];
    for (var i = 0; i < variants.length; i++) {
      if (String(variants[i].id) === String(variantId)) return variants[i];
    }
    return null;
  }

  /* After an add, the theme's cart count follows: Dawn-style themes hear
     their own cart update event, and any count the theme marks is set. */
  function refreshCartCount(variantId) {
    fetch('/cart.js', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cart) {
        if (!cart || typeof cart.item_count !== 'number') return;
        try {
          if (typeof window.publish === 'function' && window.PUB_SUB_EVENTS && window.PUB_SUB_EVENTS.cartUpdate) {
            window.publish(window.PUB_SUB_EVENTS.cartUpdate, { source: 'grindctrl-tryon', productVariantId: variantId, cartData: cart });
          }
        } catch (_) { /* a theme's own handler failing must not break ours */ }
        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } }));
        var counts = document.querySelectorAll('[data-cart-count], .cart-count-bubble span[aria-hidden="true"]');
        for (var i = 0; i < counts.length; i++) counts[i].textContent = String(cart.item_count);
      })
      .catch(function () { /* the add itself succeeded; the count catches up on the next page */ });
  }

  /* One sheet per block. It lives at the end of <body>, outside the theme's
     own containers, and keeps its iframe while closed so a look being made
     is never thrown away. */
  function createSheet(root, btn, frame, locale) {
    var copy = SHEET_COPY[locale] || SHEET_COPY.en;
    var sheet = document.createElement('div');
    sheet.className = 'gc-tryon-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', root.dataset.title || btn.textContent.trim());
    sheet.dir = locale === 'ar' ? 'rtl' : 'ltr';
    sheet.hidden = true;
    if (root.dataset.radius) sheet.style.setProperty('--gc-sheet-radius', root.dataset.radius + 'px');

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
    close.setAttribute('aria-label', copy.close);
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
    bar.appendChild(handle);
    bar.appendChild(close);
    panel.appendChild(bar);
    panel.appendChild(frame);
    sheet.appendChild(backdrop);
    sheet.appendChild(panel);
    document.body.appendChild(sheet);

    var isOpen = false;
    var pushed = false;
    var inerted = [];
    var previousOverflow = '';

    function onKey(event) {
      if (event.key === 'Escape') hide(false);
    }

    function show() {
      if (isOpen) return;
      isOpen = true;
      sheet.hidden = false;
      // The store behind stays put and out of reach until the sheet closes.
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      for (var i = 0; i < document.body.children.length; i++) {
        var child = document.body.children[i];
        if (child !== sheet && !child.inert) {
          child.inert = true;
          inerted.push(child);
        }
      }
      // The phone's back gesture closes the sheet, not the product page.
      try {
        window.history.pushState({ gcTryOnSheet: true }, '');
        pushed = true;
      } catch (_) { pushed = false; }
      document.addEventListener('keydown', onKey);
      window.requestAnimationFrame(function () { sheet.classList.add('gc-tryon-sheet--open'); });
      frame.focus();
    }

    function hide(fromHistory) {
      if (!isOpen) return;
      isOpen = false;
      sheet.classList.remove('gc-tryon-sheet--open');
      sheet.hidden = true;
      panel.style.transform = '';
      document.documentElement.style.overflow = previousOverflow;
      while (inerted.length) inerted.pop().inert = false;
      document.removeEventListener('keydown', onKey);
      if (pushed) {
        pushed = false;
        if (!fromHistory) {
          try { window.history.back(); } catch (_) { /* nothing to undo */ }
        }
      }
      btn.focus();
    }

    window.addEventListener('popstate', function () {
      if (isOpen && pushed) hide(true);
    });
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
      if (startY === null) return;
      panel.style.transform = 'translateY(' + Math.max(0, event.clientY - startY) + 'px)';
    });
    function endSwipe(event) {
      if (startY === null) return;
      var travelled = event.clientY - startY;
      startY = null;
      if (travelled > 80) hide(false);
      else panel.style.transform = '';
    }
    bar.addEventListener('pointerup', endSwipe);
    bar.addEventListener('pointercancel', endSwipe);

    return {
      element: sheet,
      open: show,
      close: function () { hide(false); },
      isOpen: function () { return isOpen; },
      destroy: function () {
        hide(false);
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
      }
    };
  }

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

  /* An anonymous id for this browser, shared with the catalogue script.
     It carries no personal data; the server keys its rate limit by shop and
     this id, because these requests reach it from Shopify's own address. */
  var VISITOR_KEY = 'gc_tryon_vid';
  var visitorIdCache = null;
  function visitorId() {
    if (visitorIdCache !== null) return visitorIdCache;
    try {
      var stored = window.localStorage.getItem(VISITOR_KEY);
      if (stored && /^[A-Za-z0-9_-]{16,64}$/.test(stored)) return (visitorIdCache = stored);
    } catch (_) { /* storage blocked: a per-page id still works */ }
    visitorIdCache = createStorefrontNonce();
    try { if (visitorIdCache) window.localStorage.setItem(VISITOR_KEY, visitorIdCache); } catch (_) {}
    return visitorIdCache;
  }

  /* The owner's preview link (?gc_preview=..., phase zero item 9). Kept in
     this store's own storage for its 24 hours and sent with every config
     and try-on context call, so the owner sees try-on before it goes live
     and their looks are free test looks. The server checks the signature. */
  var PREVIEW_KEY = 'gc_preview';
  var PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;
  function previewToken() {
    try {
      var fromUrl = new URLSearchParams(window.location.search).get('gc_preview');
      if (fromUrl && /^[A-Za-z0-9_.-]{20,512}$/.test(fromUrl)) {
        window.localStorage.setItem(PREVIEW_KEY, JSON.stringify({ token: fromUrl, savedAt: Date.now() }));
        return fromUrl;
      }
      var saved = JSON.parse(window.localStorage.getItem(PREVIEW_KEY) || 'null');
      if (saved && typeof saved.token === 'string' && Date.now() - saved.savedAt < PREVIEW_TTL_MS) return saved.token;
    } catch (_) { /* storage blocked: only a link in the address bar works */ }
    return '';
  }

  function withVisitor(url) {
    var id = visitorId();
    var preview = previewToken();
    if (id) url += '&vid=' + encodeURIComponent(id);
    if (preview) url += '&preview=' + encodeURIComponent(preview);
    return url;
  }

  /* The config's launch answer (N34). `available` is the older field, read
     only if a server without `tryOn` ever answers. A failed config read is
     not "hidden": the button keeps today's defaults, and the context route
     still refuses a store that has no looks. */
  function tryOnHidden(cfg) {
    if (!cfg) return false;
    if (cfg.tryOn === 'hidden') return true;
    return cfg.tryOn === undefined && cfg.available === false;
  }

  // The theme editor always shows the block, so a merchant who is out of
  // looks can still place and style it.
  function inThemeEditor() {
    return !!(window.Shopify && window.Shopify.designMode);
  }

  function removeBlock(root) {
    if (root.parentNode) root.parentNode.removeChild(root);
  }

  /* A shopper sent here from an in-app browser's "Open in my browser"
     (TryOn-More) lands with gc_tryon=1: the try-on opens again by itself,
     once, and the flag leaves the address so a reload does not repeat it. */
  function reopenFromLink(root, btn) {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (_) { return; }
    if (params.get('gc_tryon') !== '1' || root !== document.querySelector('.gc-tryon-root')) return;
    params.delete('gc_tryon');
    try {
      var rest = params.toString();
      window.history.replaceState(window.history.state, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
    } catch (_) { /* the try-on still opens */ }
    window.setTimeout(function () { btn.click(); }, 0);
  }

  function proxyPath(root) {
    var path = root.dataset.proxyPath || '/apps/grindctrl';
    return /^\/(apps|a|community|tools)\/[A-Za-z0-9_-]{1,30}$/.test(path) ? path : null;
  }

  function getStorefrontContext(root, nonce, variant) {
    var base = proxyPath(root);
    if (!base) return Promise.reject(new Error('invalid_proxy_path'));
    var url =
      base + '/try-on-context?product=' +
      encodeURIComponent(root.dataset.product || '') +
      '&nonce=' +
      encodeURIComponent(nonce);
    if (variant) url += '&variant=' + encodeURIComponent(variant);

    return fetch(withVisitor(url), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      // 409: this store cannot start a look now (out of looks, plan lapsed).
      if (res.status === 409) {
        var hidden = new Error('try_on_hidden');
        hidden.tryOnHidden = true;
        throw hidden;
      }
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
    var base = proxyPath(root);
    if (!base) { removeBlock(root); return; }
    fetch(withVisitor(base + '/config?locale=' + encodeURIComponent(locale)), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cfg) {
        if (tryOnHidden(cfg) && !inThemeEditor()) {
          removeBlock(root);
          return;
        }
        if (!cfg) return;
        if (v16Sheet(cfg)) {
          root.dataset.sheet = '1';
          reopenFromLink(root, btn);
        }
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
          root.dataset.radius = String(Math.max(0, Math.min(cfg.radiusPx, 28)));
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
        if (!root.parentNode) return;
        btn.classList.remove('gc-tryon-btn--loading');
        btn.removeAttribute('aria-busy');
        root.classList.remove('gc-tryon-root--pending');
      });
  }

  function mount(root) {
    var btn = root.querySelector('.gc-tryon-btn');
    if (!btn) return;

    var embedOrigin = 'https://grindctrl.cloud';
    try {
      var appUrl = new URL(root.dataset.appOrigin);
      if (appUrl.protocol === 'https:') embedOrigin = appUrl.origin;
    } catch (_) { /* use the production default */ }

    var locale = normalizeLocale(root.dataset.locale);
    applyConfig(root, btn, locale);

    var sheet = null;
    // Read once per page, on the first tap that opens the sheet.
    var storeProduct = null;
    function loadStoreProduct() {
      if (!storeProduct) storeProduct = fetchStoreProduct(root);
      return storeProduct;
    }

    btn.addEventListener('click', function () {
      // Reopening the sheet resumes whatever it held, a look included.
      if (sheet) {
        sheet.open();
        return;
      }
      var existing = root.querySelector('iframe');
      if (existing) {
        existing.style.display = existing.style.display === 'none' ? '' : 'none';
        return;
      }
      var asSheet = root.dataset.sheet === '1';
      var variant = asSheet ? selectedVariant(root) : root.dataset.variant || '';

      clearProofError(root);

      var nonce = createStorefrontNonce();
      if (!nonce) {
        showProofError(root, btn, locale);
        return;
      }
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');

      Promise.all([
        getStorefrontContext(root, nonce, variant),
        asSheet ? loadStoreProduct() : Promise.resolve(null)
      ]).then(function (ready) {
      var storefrontContext = ready[0];
      var picked = findVariant(ready[1], variant);
      var pickedTitle = (picked && picked.title) || '';

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
        embedOrigin +
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
        encodeURIComponent(variant) +
        (asSheet ? '&sheet=1' : '') +
        (pickedTitle ? '&variantTitle=' + encodeURIComponent(pickedTitle) : '') +
        '#storefrontContext=' +
        encodeURIComponent(storefrontContext.token) +
        '&storefrontNonce=' +
        encodeURIComponent(nonce);

      var frame = document.createElement('iframe');
      frame.src = src;
      frame.title = 'GrindCTRL Try-On';
      frame.className = asSheet ? 'gc-tryon-frame gc-tryon-frame--sheet' : 'gc-tryon-frame';
      // Take a photo needs the camera inside the iframe, and the in-app
      // browser note copies the store's link for iOS.
      if (asSheet) frame.setAttribute('allow', 'camera; clipboard-write');

      window.addEventListener('message', function (event) {
        if (event.source !== frame.contentWindow || event.origin !== embedOrigin || !event.data) {
          return;
        }
        if (asSheet && event.data.type === 'grindctrl-tryon:close') {
          if (sheet) sheet.close();
          return;
        }
        if (asSheet && event.data.type === 'grindctrl-tryon:checkout') {
          window.location.href = '/checkout';
          return;
        }
        if (asSheet && event.data.type === 'grindctrl-tryon:product-request') {
          loadStoreProduct().then(function (product) {
            if (product && frame.contentWindow) {
              frame.contentWindow.postMessage({ type: 'grindctrl-tryon:product', product: product, variant: variant }, embedOrigin);
            }
          });
          return;
        }
        // The sheet sizes the frame itself; only the inline frame follows its content.
        if (
          !asSheet &&
          event.data.type === 'grindctrl-tryon:height' &&
          typeof event.data.height === 'number' &&
          Number.isFinite(event.data.height) &&
          event.data.height >= 200 &&
          event.data.height <= 5000
        ) {
          frame.style.height = event.data.height + 'px';
        }
        if (event.data.type === 'grindctrl-tryon:refresh') {
          if (sheet) {
            sheet.destroy();
            sheet = null;
          } else {
            frame.remove();
          }
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
          // The sheet may name another size of this same product; anything
          // else adds the variant the shopper tapped with.
          var asked = asSheet && /^\d{1,20}$/.test(String(event.data.variantId || '')) ? String(event.data.variantId) : '';
          var choose = asked && asked !== String(variant)
            ? loadStoreProduct().then(function (product) { return findVariant(product, asked) ? asked : variant; })
            : Promise.resolve(variant);
          choose.then(function (chosen) {
          var variantId = parseInt(chosen, 10);
          if (!variantId) return fail();
          fetch('/cart/add.js', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }] })
          })
            .then(function (res) {
              // In the sheet the shopper stays on the look: say what was added
              // and refresh the theme's cart count, never leave for /cart.
              if (res.ok && asSheet) {
                return res.json().then(function (data) {
                  var item = data && data.items && data.items[0];
                  frame.contentWindow.postMessage(
                    { type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: (item && item.variant_title) || '' },
                    embedOrigin
                  );
                  refreshCartCount(variantId);
                }, function () {
                  frame.contentWindow.postMessage({ type: 'grindctrl-tryon:cart-result', ok: true, variantTitle: '' }, embedOrigin);
                  refreshCartCount(variantId);
                });
              }
              if (res.ok) { window.location.href = '/cart'; return; }
              return res.json().then(
                function (data) { fail(data && (data.description || data.message)); },
                function () { fail(); }
              );
            })
            .catch(function () { fail(); });
          });
        }
      });

      if (asSheet) {
        sheet = createSheet(root, btn, frame, locale);
        sheet.open();
      } else {
        root.appendChild(frame);
      }
      }).catch(function (error) {
        // The looks ran out after this page loaded: take the button away
        // rather than show an error the shopper cannot act on.
        if (error && error.tryOnHidden) {
          removeBlock(root);
          return;
        }
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
