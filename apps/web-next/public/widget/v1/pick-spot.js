/**
 * GRINDCTRL Pick a spot: the edit chrome (Pack B, B2 to B7).
 *
 * Loaded by tryon-engine.js only after GRINDCTRL verified this tab's
 * one-time link, which the dashboard opened. It reads
 * window.GRINDCTRL_PICK_CONFIG = { token, claim, appOrigin, preset, look, forget }.
 *
 * Two visual worlds: everything drawn here (toolbar, highlight, label tag,
 * tooltip, callout) is GRINDCTRL's own cream and charcoal, inside a closed
 * Shadow DOM so the store's CSS cannot reach it, fixed above the page so it
 * never shifts the layout. The preview is the store's real Try-On button in
 * the owner's colours, moved by the engine; it is the only thing that
 * changes the page.
 *
 * Desktop: hover highlights, a click selects. Phone (<= 640px or touch):
 * the first tap highlights, a second tap on the same element selects, and
 * a scroll never selects. Keyboard: Tab moves between elements that can be
 * chosen, Enter selects, Escape cancels.
 *
 * Classic ES5, no dependencies. Fails quiet: it must never break the store.
 */
(function () {
  'use strict';

  var CFG = window.GRINDCTRL_PICK_CONFIG;
  var engine = window.GRINDCTRL_TRYON_ENGINE;
  if (!CFG || typeof CFG.token !== 'string' || typeof CFG.claim !== 'string' || !engine || window.GRINDCTRL_PICK_SPOT) return;

  var PHONE_MAX = 640;
  var MIN_SIZE = 24;
  var MAX_MATCHES = 3;
  var MAX_DEPTH = 5;
  var MAX_SELECTOR = 300;
  var LABEL_MAX = 60;
  var TOOLTIP_MS = 2500;
  var DASHBOARD_PATH = '/dashboard/try-on/setup#button-placement';

  var locale = /^ar\b/i.test(document.documentElement.lang || '') || String(document.documentElement.dir).toLowerCase() === 'rtl' ? 'ar' : 'en';
  var COPY = {
    en: {
      tap: 'Tap where the Try-On button should go',
      click: 'Click where the Try-On button should go',
      cancel: 'Cancel',
      guard: 'Choose a spot on the product itself',
      title: 'Put Try-On here?',
      above: 'Above',
      below: 'Below',
      save: 'Save',
      another: 'Pick another spot',
      saved: 'Saved. Try-On will appear here on all product pages.',
      back: 'Back to dashboard',
      failed: "Couldn't save. Check your connection and try again.",
      nonProduct: 'Open any product page to choose the spot',
      expired: 'This link has expired. Open Pick a spot again from your dashboard.',
      button: 'Button',
      image: 'Image'
    },
    ar: {
      tap: 'اضغط حيث تريد زر القياس',
      click: 'انقر حيث تريد زر القياس',
      cancel: 'إلغاء',
      guard: 'اختر مكانًا داخل صفحة المنتج نفسه',
      title: 'تضع زر القياس هنا؟',
      above: 'فوق',
      below: 'تحت',
      save: 'حفظ',
      another: 'اختر مكانًا آخر',
      saved: 'تم الحفظ. سيظهر زر القياس هنا في كل صفحات المنتجات.',
      back: 'العودة للوحة التحكم',
      failed: 'تعذّر الحفظ. تحقق من الاتصال وحاول مرة أخرى.',
      nonProduct: 'افتح أي صفحة منتج لاختيار المكان',
      expired: 'انتهت صلاحية هذا الرابط. افتح «اختر المكان» مرة أخرى من لوحة التحكم.',
      button: 'زر',
      image: 'صورة'
    }
  };
  var t = COPY[locale];

  /* Never a spot: the store's frame (header, menus, footer), drawers and
     dialogs, other products' cards, Store Chat and our own nodes. */
  var FRAME = 'header,nav,footer,[role="banner"],[role="navigation"],[role="contentinfo"]';
  // A header or nav inside the product content (a title block, breadcrumbs) is part of the product.
  var CONTENT = 'main,article,[role="main"],.product,[itemtype*="schema.org/Product"]';
  var EXCLUDED = [
    'dialog', '[role="dialog"]', '[aria-modal="true"]',
    'cart-drawer', 'cart-notification', '#CartDrawer', '[class*="cart-drawer"]', '[class*="cart_drawer"]', '[class*="CartDrawer"]',
    '[class*="mini-cart"]', '[class*="minicart"]', '[class*="side-cart"]', '.widget_shopping_cart',
    'product-recommendations', '.product-recommendations', '.related', '.related-products', '.upsells', '.cross-sells',
    '.card-wrapper', '.product-card-wrapper', '.card--product', '[class*="product-card"]', '[class*="ProductCard"]',
    'li.product', '.wc-block-grid__product', '.wc-block-product', '.grid-product', '[data-grindctrl-card]',
    '[data-gc-chat-launcher]', '[data-gc-pick]', '.gc-tryon-btn', '.gc-tryon-pill', '.gc-tryon-note', '.gc-tryon-sheet', '.gc-tryon-root'
  ].join(',');
  // What a pointer or Tab lands on: the element a person means, not a span inside it.
  var MEANINGFUL = 'button,a,[role="button"],img,picture,video,input,select,textarea,label,h1,h2,h3,h4,h5,h6,p,li,form,fieldset';
  var TAB_STOPS = 'button,a[href],[role="button"],img,input,select,textarea,h1,h2,h3,p,form';
  var GENERIC = /^(HTML|BODY|MAIN|SCRIPT|STYLE|IFRAME|TEMPLATE|NOSCRIPT|SOURCE|SVG|PATH)$/i;

  /* ── Selector builder ─────────────────────────────────────────────────
     Stable attributes first: an id that does not look generated, data-*
     attributes, cart forms and named Add to cart buttons; then a short
     class path. Never more than MAX_DEPTH levels, never a selector that
     matches more than MAX_MATCHES elements, and the chosen element must be
     the first match shown, which is the one the engine will use. The
     grammar is the server's (lib/try-on/placement.ts validSpotSelector). */

  var NAME = '[A-Za-z_][A-Za-z0-9_-]*';
  var COMPOUND = new RegExp('^(?:[a-z][a-z0-9-]*)?(?:#' + NAME + '|\\.' + NAME + '|\\[' + NAME + '(?:[*^$]?="[A-Za-z0-9_./: -]{1,80}")?\\])*$');
  var VALUE = /^[A-Za-z0-9_./: -]{1,80}$/;
  var IGNORED_DATA = /^data-(gc|grindctrl|product-id|productid|variant|section-id|section|block-id|id$|index|v-|react|testid-|aos|ref|key|state|loaded|visible|active|selected|open|expanded|src|srcset|sizes|widths|image)/i;

  function validSelector(value) {
    if (typeof value !== 'string' || !value || value.length > MAX_SELECTOR || /javascript:/i.test(value) || /[\\'`<{};,]/.test(value)) return false;
    var levels = value.split(/ > | (?=(?:[^"]*"[^"]*")*[^"]*$)/);
    if (levels.length > MAX_DEPTH) return false;
    for (var i = 0; i < levels.length; i++) if (!levels[i] || !COMPOUND.test(levels[i])) return false;
    return true;
  }
  // Generated names: long digit runs, hashes, framework prefixes, CSS module suffixes.
  function stableName(value) {
    return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,60}$/.test(value) &&
      !/\d{4,}|[0-9a-f]{8,}|__[A-Za-z0-9]{5}$|^(gc-|css-|sc-|jsx-|svelte-|ember|react|ng-|v-|is-|has-|js-|shopify-section|template--|swiper-slide-active)/i.test(value);
  }
  function shownMatches(selector) {
    var nodes;
    try { nodes = document.querySelectorAll(selector); } catch (_) { return null; }
    if (!nodes.length || nodes.length > MAX_MATCHES) return null;
    var list = [];
    for (var i = 0; i < nodes.length; i++) list.push(nodes[i]);
    return list;
  }
  function firstShown(list) {
    for (var i = 0; i < list.length; i++) if (visible(list[i])) return list[i];
    return null;
  }
  /** One level for an element, most stable first. */
  function pieces(node) {
    var tag = node.tagName.toLowerCase();
    var out = [];
    if (!/^[a-z][a-z0-9-]*$/.test(tag)) return out;
    if (stableName(node.id)) out.push('#' + node.id);
    for (var i = 0; i < node.attributes.length; i++) {
      var attr = node.attributes[i];
      if (!/^data-[a-z0-9_-]{1,40}$/.test(attr.name) || IGNORED_DATA.test(attr.name)) continue;
      if (VALUE.test(attr.value) && !/\d{4,}/.test(attr.value)) out.push(tag + '[' + attr.name + '="' + attr.value + '"]');
      else if (!attr.value) out.push(tag + '[' + attr.name + ']');
    }
    if (tag === 'form' && /cart/i.test(node.getAttribute('action') || '')) out.push('form[action*="cart"]');
    var name = node.getAttribute('name');
    if (/^(button|input|select)$/.test(tag) && name && VALUE.test(name) && stableName(name)) out.push(tag + '[name="' + name + '"]');
    var itemprop = node.getAttribute('itemprop');
    if (itemprop && stableName(itemprop)) out.push(tag + '[itemprop="' + itemprop + '"]');
    var classes = [];
    for (var c = 0; c < node.classList.length && classes.length < 3; c++) if (stableName(node.classList[c])) classes.push(node.classList[c]);
    for (var k = 1; k <= classes.length; k++) out.push(tag + '.' + classes.slice(0, k).join('.'));
    out.push(tag);
    return out.filter(function (piece) { return COMPOUND.test(piece); });
  }
  function buildSelector(node) {
    if (!node || node.nodeType !== 1) return '';
    var own = pieces(node);
    if (!own.length) return '';
    var loose = '';
    function consider(selector) {
      if (selector.length > MAX_SELECTOR || !validSelector(selector)) return false;
      var list = shownMatches(selector);
      if (!list || firstShown(list) !== node) return false;
      if (list.length === 1) return true;
      if (!loose) loose = selector;
      return false;
    }
    var i, j;
    for (i = 0; i < own.length; i++) if (consider(own[i])) return own[i];
    // An ancestor with a stable name, any distance up: robust to wrappers changing in between.
    var best = own[0];
    var ancestor = node.parentElement;
    for (var up = 1; ancestor && ancestor !== document.body && up < 8; up++, ancestor = ancestor.parentElement) {
      var named = pieces(ancestor).filter(function (piece) { return /[#\[]/.test(piece); });
      for (j = 0; j < named.length; j++) {
        for (i = 0; i < own.length; i++) {
          var scoped = named[j] + ' ' + own[i];
          if (consider(scoped)) return scoped;
        }
      }
    }
    // A short chain of direct parents.
    var path = best;
    var parent = node.parentElement;
    for (var depth = 2; parent && parent !== document.body && depth <= MAX_DEPTH; depth++, parent = parent.parentElement) {
      var ups = pieces(parent);
      for (j = 0; j < ups.length; j++) {
        var chained = ups[j] + ' > ' + path;
        if (consider(chained)) return chained;
      }
      path = (ups.length > 1 ? ups[ups.length - 2] : ups[0]) + ' > ' + path;
    }
    return loose;
  }

  /* ── What can be chosen ───────────────────────────────────────────────── */

  function visible(node) {
    if (!node || !node.isConnected) return false;
    for (var n = node; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') return false;
      var style = window.getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    }
    return true;
  }
  function refusedArea(node) {
    if (node.closest(EXCLUDED)) return true;
    var frame = node.closest(FRAME);
    return !!frame && !frame.closest(CONTENT);
  }
  function excluded(node) {
    return !node || node.nodeType !== 1 || GENERIC.test(node.tagName) || node.getAttribute('role') === 'main' || refusedArea(node);
  }
  function bigEnough(node) {
    var box = node.getBoundingClientRect();
    return box.width >= MIN_SIZE && box.height >= MIN_SIZE;
  }
  function selectable(node) {
    return !excluded(node) && visible(node) && bigEnough(node);
  }
  /** The element a pointer on `target` means, or null. `refused`: the store's
   *  frame, another product, ours, or too small or hidden to hold the button,
   *  which the tooltip explains. The page background is neither. */
  function resolve(target) {
    if (!target || target.nodeType !== 1 || target === host) return { node: null, refused: false };
    if (refusedArea(target)) return { node: null, refused: true };
    var node = target.closest(MEANINGFUL) || target;
    // Text inside a line (a price's <bdi>, a <strong>) chooses the line itself.
    while (node.parentElement && node.parentElement !== document.body && !/^(BUTTON|INPUT|SELECT|TEXTAREA|IMG|PICTURE|VIDEO|SVG)$/i.test(node.tagName) &&
      /^(inline|contents)$/.test(window.getComputedStyle(node).display)) {
      node = node.parentElement;
    }
    // A tiny icon or a hidden layer: the nearest parent that can be chosen.
    for (var up = 0; node && up < 4 && !selectable(node); up++) node = node.parentElement;
    if (node && selectable(node)) return { node: node, refused: false };
    return { node: null, refused: !GENERIC.test(target.tagName) };
  }
  function productPage() {
    if (document.querySelector('.gc-tryon-btn[data-product-id]:not(.gc-tryon-btn--card),meta[property="og:type"][content^="product"],' +
      '[itemtype*="schema.org/Product"],body.single-product,.single_add_to_cart_button,button[name="add-to-cart"],button[name="add"]')) return true;
    var forms = document.querySelectorAll('form[action*="/cart/add"],form.cart');
    for (var i = 0; i < forms.length; i++) if (!forms[i].closest(EXCLUDED)) return true;
    try {
      if (window.GRINDCTRL_TRYON_PASTE && window.GRINDCTRL_TRYON_PASTE.detectWebsiteProduct()) return true;
    } catch (_) {}
    return /\/(products?|item)\/[^/]+/.test(window.location.pathname);
  }
  /** Up to 3 of the store's own product pages linked from this page. */
  function productLinks() {
    var found = [];
    var seen = {};
    var anchors = document.querySelectorAll('a[href]');
    for (var i = 0; i < anchors.length && found.length < 3; i++) {
      var a = anchors[i];
      if (a.closest(FRAME + ',[data-gc-pick]')) continue;
      var url;
      try { url = new URL(a.getAttribute('href'), window.location.href); } catch (_) { continue; }
      if (url.origin !== window.location.origin || seen[url.pathname]) continue;
      if (!/\/(products?|item)\/[^/]+/.test(url.pathname) && !a.matches('.woocommerce-LoopProduct-link,.wc-block-grid__product-link')) continue;
      var text = labelOf(a) || decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      if (!text) continue;
      seen[url.pathname] = true;
      url.hash = '';
      found.push({ href: url.href, text: text });
    }
    return found;
  }
  function labelOf(node) {
    var text = '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)) text = node.value || node.getAttribute('placeholder') || node.getAttribute('aria-label') || '';
    else if (node.tagName === 'IMG') text = node.getAttribute('alt') || '';
    else {
      var copy = node.cloneNode(true);
      var ours = copy.querySelectorAll('.gc-tryon-btn,.gc-tryon-note,.gc-tryon-live,[data-gc-pick],script,style');
      for (var i = 0; i < ours.length; i++) ours[i].remove();
      text = copy.textContent || node.getAttribute('aria-label') || '';
      if (!text.trim()) {
        var img = node.querySelector('img[alt]');
        if (img) text = img.getAttribute('alt');
      }
    }
    return text.replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX).trim();
  }
  function kindOf(node) {
    if (/^(IMG|PICTURE|VIDEO|SVG)$/i.test(node.tagName) || (!labelOf(node) && node.querySelector('img'))) return 'image';
    if (/^(BUTTON|A|INPUT|SELECT)$/.test(node.tagName) || node.getAttribute('role') === 'button') return 'button';
    return 'other';
  }
  function tagText(node) {
    var kind = kindOf(node);
    if (kind === 'image') return t.image;
    var text = labelOf(node);
    return kind === 'button' ? t.button + (text ? ' · ' + text : '') : text || node.tagName.toLowerCase();
  }
  // Charcoal on light pages, cream on dark ones: by the colour behind the element.
  function darkBehind(node) {
    for (var n = node; n && n.nodeType === 1; n = n.parentElement) {
      var bg = window.getComputedStyle(n).backgroundColor || '';
      var rgb = bg.match(/[\d.]+/g);
      if (!rgb || rgb.length < 3 || (rgb.length > 3 && Number(rgb[3]) === 0)) continue;
      return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 < 0.5;
    }
    return false;
  }

  /* ── The chrome ───────────────────────────────────────────────────────── */

  var host = document.createElement('div');
  host.setAttribute('data-gc-pick', '');
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;' +
    'display:block!important;pointer-events:none!important;contain:layout style!important';
  var root = host.attachShadow({ mode: 'open' });
  var style = document.createElement('style');
  style.textContent = [
    ':host{all:initial}*{box-sizing:border-box}',
    '.chrome{--ink:#1f1d1a;--paper:#f6f1e7;--line:rgba(31,29,26,.22);font:14px/1.5 Manrope,"IBM Plex Sans Arabic",system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink)}',
    '.panel{position:fixed;pointer-events:auto;background:var(--paper);color:var(--ink);border-radius:12px;box-shadow:0 8px 30px rgba(31,29,26,.18),0 1px 3px rgba(31,29,26,.12)}',
    '.panel[hidden],.outline[hidden],.tag[hidden],.tip[hidden]{display:none}',
    '.toolbar{inset-block-start:12px;inset-inline:50% auto;transform:translateX(-50%);display:flex;align-items:center;gap:12px;flex-wrap:wrap;',
    'inline-size:max-content;max-inline-size:calc(100vw - 32px);padding:8px 8px 8px 16px;padding-inline:16px 8px}',
    '.chrome[dir="rtl"] .toolbar{transform:translateX(50%);inset-inline:auto 50%}',
    '.mark{font-weight:800;letter-spacing:.08em;font-size:12px}',
    '.instruction{flex:1 1 auto;min-inline-size:0;overflow-wrap:anywhere}',
    '.links{display:flex;flex-wrap:wrap;gap:8px;flex-basis:100%}',
    'button,a.action{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-block-size:44px;min-inline-size:44px;padding:8px 14px;',
    'border:1px solid var(--line);border-radius:12px;background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer;text-decoration:none}',
    'button:hover,a.action:hover{background:rgba(31,29,26,.06)}',
    'button:focus-visible,a.action:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--ink);outline-offset:2px}',
    'button:disabled{opacity:.6;cursor:default}',
    '.primary{background:var(--ink);color:var(--paper);border-color:var(--ink)}.primary:hover{background:#000}',
    '.segment{display:flex;padding:2px;border:1px solid var(--line);border-radius:12px;gap:2px}',
    '.segment button{flex:1 1 0;border:0;border-radius:10px;min-inline-size:72px}',
    '.segment [aria-pressed="true"]{background:var(--ink);color:var(--paper)}',
    '.callout{inline-size:min(320px,calc(100vw - 32px));padding:16px;display:grid;gap:12px}',
    '.head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.callout h2{margin:0;font:inherit;font-size:16px;font-weight:700;line-height:1.4}',
    '.callout h2:focus{outline:none}',
    '.quiet{border-color:transparent;padding-inline:10px}',
    '.actions{display:flex;flex-wrap:wrap;gap:8px}.actions .primary{flex:1 1 auto}',
    '.message{margin:0;color:#8a1c1c;font-weight:600;overflow-wrap:anywhere}.message:empty{display:none}',
    // Two rings, charcoal and cream, so the outline shows on any page and any element.
    '.outline{position:fixed;pointer-events:none;border:2px solid var(--hl);box-shadow:0 0 0 2px var(--hl-ring);background:var(--hl-fill);border-radius:4px}',
    '.tag,.tip{position:fixed;pointer-events:none;max-inline-size:min(320px,calc(100vw - 16px));padding:3px 8px;border-radius:6px;',
    'font-size:12px;font-weight:600;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tag{background:var(--hl);color:var(--hl-ink)}',
    '.tip{background:var(--ink);color:var(--paper);white-space:normal}',
    '.spinner{inline-size:16px;block-size:16px;border:2px solid currentColor;border-inline-end-color:transparent;border-radius:50%;animation:spin .8s linear infinite}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '.sr{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
    // Phones and touch: the toolbar and the callout are one bottom bar, clear of the home indicator.
    '.phone .toolbar,.phone .callout{inset-block:auto 0!important;inset-inline:0!important;transform:none!important;inline-size:100%;max-inline-size:100%;',
    'border-radius:12px 12px 0 0;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px))}',
    '.phone .mark{display:none}',
    '@media (prefers-reduced-motion:reduce){.spinner{animation:none;border-inline-end-color:currentColor;opacity:.6}}'
  ].join('');
  root.appendChild(style);

  var chrome = document.createElement('div');
  chrome.className = 'chrome';
  chrome.dir = locale === 'ar' ? 'rtl' : 'ltr';
  chrome.lang = locale;
  root.appendChild(chrome);

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function action(parent, text, onClick, primary) {
    var b = el('button', primary ? 'primary' : '', text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    parent.appendChild(b);
    return b;
  }

  var outline = el('div', 'outline');
  var tag = el('div', 'tag');
  var tip = el('div', 'tip', t.guard);
  var toolbar = el('div', 'panel toolbar');
  var callout = el('div', 'panel callout');
  var live = el('div', 'sr');
  outline.hidden = tag.hidden = tip.hidden = callout.hidden = true;
  outline.setAttribute('aria-hidden', 'true');
  tag.setAttribute('aria-hidden', 'true');
  toolbar.setAttribute('role', 'region');
  toolbar.setAttribute('aria-label', 'GRINDCTRL');
  callout.setAttribute('role', 'dialog');
  callout.setAttribute('aria-label', t.title);
  tip.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  [outline, tag, tip, toolbar, callout, live].forEach(function (node) { chrome.appendChild(node); });
  document.body.appendChild(host);

  /* ── State ────────────────────────────────────────────────────────────── */

  var onProduct = false;
  var highlighted = null;
  var selected = null;
  var position = 'after';
  var saving = false;
  var done = false;
  var touch = false;
  var touchStart = null;
  var scrolled = false;
  var tabIndex = -1;
  var tipTimer = null;
  var listeners = [];
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function phone() { return touch || window.innerWidth <= PHONE_MAX; }
  var phoneLayout = null;
  /** Whether the layout switched between desktop and phone. */
  function layout() {
    var now = phone();
    chrome.classList.toggle('phone', now);
    if (now) callout.style.left = callout.style.top = '';
    var changed = phoneLayout !== null && phoneLayout !== now;
    phoneLayout = now;
    return changed;
  }
  function listen(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    listeners.push([target, type, fn, options]);
  }
  function fromChrome(event) {
    return event.target === host || (event.composedPath && event.composedPath().indexOf(host) !== -1);
  }

  function hideTip() { tip.hidden = true; if (tipTimer) clearTimeout(tipTimer); tipTimer = null; }
  function showTip(near) {
    tip.hidden = false;
    var box = near && near.getBoundingClientRect ? near.getBoundingClientRect() : null;
    var top = box ? (box.top >= 40 ? box.top - 34 : box.bottom + 8) : window.innerHeight / 2;
    var start = box ? Math.max(8, Math.min(box.left, window.innerWidth - 248)) : 16;
    tip.style.top = Math.max(8, Math.min(top, window.innerHeight - 48)) + 'px';
    tip.style.left = start + 'px';
    live.textContent = t.guard;
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, TOOLTIP_MS);
  }

  /* The outline over the element and its tag beside it, never on it: above,
     or below when there is no room above (the top toolbar included). */
  function draw(node) {
    highlighted = node;
    if (!node) { outline.hidden = true; tag.hidden = true; return; }
    var dark = darkBehind(node);
    chrome.style.setProperty('--hl', dark ? '#f6f1e7' : '#1f1d1a');
    chrome.style.setProperty('--hl-ink', dark ? '#1f1d1a' : '#f6f1e7');
    chrome.style.setProperty('--hl-ring', dark ? '#1f1d1a' : '#f6f1e7');
    chrome.style.setProperty('--hl-fill', dark ? 'rgba(246,241,231,.08)' : 'rgba(31,29,26,.08)');
    var r = node.getBoundingClientRect();
    outline.style.left = (r.left - 2) + 'px';
    outline.style.top = (r.top - 2) + 'px';
    outline.style.width = (r.width + 4) + 'px';
    outline.style.height = (r.height + 4) + 'px';
    outline.hidden = false;
    tag.textContent = tagText(node);
    tag.hidden = false;
    var reserved = !phone() && !toolbar.hidden ? toolbar.getBoundingClientRect().bottom + 4 : 0;
    var tagHeight = 26;
    var top = r.top - tagHeight - 6 >= reserved ? r.top - tagHeight - 6 : r.bottom + 6;
    tag.style.top = Math.min(top, window.innerHeight - tagHeight) + 'px';
    var tagWidth = Math.min(320, tag.offsetWidth || 160);
    var start = locale === 'ar' ? r.right - tagWidth : r.left;
    tag.style.left = Math.max(8, Math.min(start, window.innerWidth - tagWidth - 8)) + 'px';
    if (selected === node && !phone()) placeCallout(r);
  }
  // Beside the element on desktop (its inline end, else start, else below).
  function placeCallout(r) {
    callout.style.removeProperty('inset');
    var width = callout.offsetWidth || 320;
    var height = callout.offsetHeight || 200;
    var gap = 16;
    var after = locale === 'ar' ? r.left - gap - width : r.right + gap;
    var before = locale === 'ar' ? r.right + gap : r.left - gap - width;
    var left;
    var top;
    if (after >= 16 && after + width <= window.innerWidth - 16) { left = after; top = r.top; }
    else if (before >= 16 && before + width <= window.innerWidth - 16) { left = before; top = r.top; }
    else { left = r.left; top = r.bottom + gap; }
    callout.style.left = Math.max(16, Math.min(left, window.innerWidth - width - 16)) + 'px';
    callout.style.top = Math.max(16, Math.min(top, window.innerHeight - height - 16)) + 'px';
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function idle() {
    selected = null;
    position = 'after';
    callout.hidden = true;
    toolbar.hidden = false;
    layout();
    clear(toolbar);
    draw(null);
    toolbar.appendChild(el('span', 'mark', 'GRINDCTRL'));
    // Read once per toolbar, not on every pointer move.
    onProduct = productPage();
    toolbar.appendChild(el('span', 'instruction', onProduct ? (phone() ? t.tap : t.click) : t.nonProduct));
    action(toolbar, t.cancel, cancel);
    if (!onProduct) {
      var links = productLinks();
      if (links.length) {
        var list = el('div', 'links');
        links.forEach(function (link) {
          var a = el('a', 'action', link.text);
          a.href = link.href;
          list.appendChild(a);
        });
        toolbar.appendChild(list);
      }
    }
  }

  /* ── Selected: the callout and the live preview (B4) ─────────────────── */

  var message = el('p', 'message');
  message.setAttribute('role', 'alert');
  var saveButton = null;

  function choose(node, startAt) {
    if (!selectable(node) || !buildSelector(node)) { showTip(node); return; }
    hideTip();
    selected = node;
    position = startAt === 'before' ? 'before' : 'after';
    toolbar.hidden = true;
    clear(callout);
    var head = el('div', 'head');
    var title = el('h2', '', t.title);
    title.tabIndex = -1;
    head.appendChild(title);
    action(head, t.cancel, cancel).classList.add('quiet');
    callout.appendChild(head);
    var segment = el('div', 'segment');
    segment.setAttribute('role', 'group');
    segment.setAttribute('aria-label', t.title);
    var above = action(segment, t.above, function () { position = 'before'; sync(); show(); });
    var below = action(segment, t.below, function () { position = 'after'; sync(); show(); });
    function sync() {
      above.setAttribute('aria-pressed', String(position === 'before'));
      below.setAttribute('aria-pressed', String(position === 'after'));
    }
    sync();
    callout.appendChild(segment);
    message.textContent = '';
    callout.appendChild(message);
    var actions = el('div', 'actions');
    saveButton = action(actions, t.save, save, true);
    action(actions, t.another, function () { if (!saving) { engine.endPreview(false); idle(); } });
    callout.appendChild(actions);
    callout.hidden = false;
    layout();
    show();
    title.focus({ preventScroll: true });
  }
  function show() {
    if (!selected) return;
    var button = engine.preview(selected, position, CFG.look);
    draw(selected);
    if (button && button.scrollIntoView) {
      button.scrollIntoView({ block: phone() ? 'center' : 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    }
    // The page moved under the fixed chrome: draw again where things now are.
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () { if (selected) draw(selected); });
  }

  function save() {
    if (saving || !selected) return;
    var selector = buildSelector(selected);
    if (!selector) { message.textContent = t.guard; return; }
    saving = true;
    message.textContent = '';
    saveButton.disabled = true;
    saveButton.setAttribute('aria-busy', 'true');
    var spinner = el('span', 'spinner');
    spinner.setAttribute('aria-hidden', 'true');
    saveButton.appendChild(spinner);
    var path = window.location.pathname;
    window.fetch(CFG.appOrigin + '/api/try-on/pick/save', {
      method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ token: CFG.token, claim: CFG.claim, selector: selector, position: position,
        label: labelOf(selected), pathHint: path.length <= 1024 && !/[\s?#\\]/.test(path) ? path : '/' })
    }).then(function (res) {
      if (res.status === 410) return 'expired';
      if (!res.ok) throw new Error('save_failed');
      return res.json().then(function (data) { if (!data || data.ok !== true) throw new Error('save_failed'); return 'saved'; });
    }).then(function (outcome) {
      saving = false;
      spinner.remove();
      saveButton.removeAttribute('aria-busy');
      if (outcome === 'expired') { expired(); return; }
      saved();
    }, function () {
      // Retry keeps the selection and the preview.
      saving = false;
      spinner.remove();
      saveButton.removeAttribute('aria-busy');
      saveButton.disabled = false;
      message.textContent = t.failed;
    });
  }

  function expired() {
    forget();
    saveButton.disabled = true;
    message.textContent = t.expired;
  }

  function saved() {
    done = true;
    forget();
    engine.endPreview(true);
    detach();
    selected = null;
    draw(null);
    hideTip();
    callout.hidden = true;
    toolbar.hidden = false;
    clear(toolbar);
    var toast = el('span', 'instruction', t.saved);
    toast.setAttribute('role', 'status');
    toolbar.appendChild(toast);
    var back = el('a', 'action primary', t.back);
    back.href = CFG.appOrigin + DASHBOARD_PATH;
    back.rel = 'noreferrer';
    back.addEventListener('click', function (event) {
      // The dashboard opened this tab and is still open: close it. Otherwise follow the link.
      event.preventDefault();
      try { window.close(); } catch (_) {}
      setTimeout(function () { if (!window.closed) window.location.assign(back.href); }, 250);
    });
    toolbar.appendChild(back);
    back.focus({ preventScroll: true });
  }

  function forget() {
    if (typeof CFG.forget === 'function') CFG.forget();
  }
  function detach() {
    listeners.splice(0).forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    if (tipTimer) clearTimeout(tipTimer);
  }
  function cancel() {
    if (saving) return;
    forget();
    engine.endPreview(!!done);
    detach();
    host.remove();
    window.GRINDCTRL_PICK_SPOT = null;
  }

  /* ── Input ────────────────────────────────────────────────────────────── */

  listen(document, 'pointerdown', function (event) {
    if (!event.pointerType) return;
    touch = event.pointerType !== 'mouse';
    if (layout() && !selected && !done) idle();
  }, true);
  listen(document, 'mouseover', function (event) {
    if (phone() || selected || done || fromChrome(event) || !onProduct) return;
    var hit = resolve(event.target);
    if (hit.node) { hideTip(); draw(hit.node); }
    else if (hit.refused) { draw(null); showTip(event.target); }
  }, true);
  listen(document, 'click', function (event) {
    if (done || fromChrome(event) || !onProduct) return;
    // The store's own links and buttons do nothing while a spot is chosen.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (selected || saving) return;
    if (scrolled) { scrolled = false; return; }
    var hit = resolve(event.target);
    if (!hit.node) { draw(null); showTip(event.target); return; }
    hideTip();
    // Phone: the first tap highlights, a second tap on the same element chooses it.
    if (phone() && highlighted !== hit.node) { draw(hit.node); live.textContent = tagText(hit.node); return; }
    choose(hit.node);
  }, true);
  listen(document, 'submit', function (event) {
    if (!done && !fromChrome(event) && onProduct) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  listen(document, 'touchstart', function (event) {
    touch = true;
    scrolled = false;
    var p = event.touches && event.touches[0];
    touchStart = p ? { x: p.clientX, y: p.clientY } : null;
  }, { capture: true, passive: true });
  listen(document, 'touchmove', function (event) {
    var p = event.touches && event.touches[0];
    if (touchStart && p && (Math.abs(p.clientX - touchStart.x) > 8 || Math.abs(p.clientY - touchStart.y) > 8)) scrolled = true;
  }, { capture: true, passive: true });
  listen(window, 'scroll', function () {
    if (selected || (highlighted && !phone())) draw(selected || highlighted);
    else if (highlighted) draw(null);
    hideTip();
  }, { capture: true, passive: true });
  // Phones resize as the address bar slides: only a switch of layout redraws the toolbar.
  listen(window, 'resize', function () {
    var switched = layout();
    if (selected) draw(selected);
    else if (switched && !done) idle();
    else if (highlighted) draw(highlighted);
  });
  listen(document, 'keydown', function (event) {
    if (event.key === 'Escape' && !saving && !done) { event.preventDefault(); cancel(); return; }
    if (fromChrome(event) || selected || done || !onProduct) return;
    if (event.key === 'Tab') {
      var stops = Array.prototype.filter.call(document.querySelectorAll(TAB_STOPS), selectable);
      if (!stops.length) return;
      event.preventDefault();
      var at = highlighted ? stops.indexOf(highlighted) : tabIndex;
      tabIndex = ((at < 0 ? (event.shiftKey ? 0 : -1) : at) + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
      var next = stops[tabIndex];
      if (next.scrollIntoView) next.scrollIntoView({ block: 'center', behavior: 'auto' });
      draw(next);
      live.textContent = tagText(next);
    } else if (event.key === 'Enter' && highlighted) {
      event.preventDefault();
      event.stopImmediatePropagation();
      choose(highlighted);
    }
  }, true);

  window.GRINDCTRL_PICK_SPOT = { buildSelector: buildSelector, validSelector: validSelector, selectable: selectable, cancel: cancel };

  idle();

  // "Test on my store" from the dashboard's advanced field: that element, chosen.
  var preset = CFG.preset;
  if (preset && validSelector(preset.selector) && onProduct) {
    var matches = shownMatches(preset.selector);
    var first = matches && firstShown(matches);
    if (first && selectable(first)) choose(first, preset.position);
  }
})();
