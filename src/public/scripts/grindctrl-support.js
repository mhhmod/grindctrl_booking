/**
 * GRINDCTRL Embeddable Support Widget (Loader)
 *
 * Production loader that supports:
 * - queue pattern (config objects + callbacks)
 * - attribute-based init (CSP-friendly)
 * - async runtime loading
 *
 * This file is the stable public snippet URL.
 */
(function (window, document) {
  'use strict';

  var LOADER_VERSION = '1.0.0';
  var GLOBAL_KEY = '__gc_widget_loader__';

  if (window[GLOBAL_KEY] && window[GLOBAL_KEY].version) {
    // Already installed.
    return;
  }

  function warn(msg) {
    try { console.warn('[GrindctrlSupport]', msg); } catch (e) {}
  }

  function getRuntimeSrc() {
    // Load runtime from the same base as the loader script.
    // Examples:
    // - https://cdn.grindctrl.com/widget/v1/loader.js -> .../runtime.js
    // - https://cdn.grindctrl.com/grindctrl-support.js -> .../grindctrl-support-runtime.js
    var scriptEl = document.currentScript;
    if (!scriptEl || !scriptEl.src) {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var s = scripts[i];
        if (!s || !s.src) continue;
        if (s.src.indexOf('grindctrl-support.js') >= 0 || s.src.indexOf('loader.js') >= 0) {
          scriptEl = s;
          break;
        }
      }
    }

    var src = scriptEl && scriptEl.src ? String(scriptEl.src) : '';
    if (!src) {
      // Dev fallback (Vite public dir)
      return '/scripts/grindctrl-support-runtime.js';
    }

    if (src.indexOf('/widget/v1/loader.js') >= 0) {
      return src.replace('/widget/v1/loader.js', '/widget/v1/runtime.js');
    }
    if (src.indexOf('grindctrl-support.js') >= 0) {
      return src.replace('grindctrl-support.js', 'grindctrl-support-runtime.js');
    }
    if (src.indexOf('grindctrl-support-loader.js') >= 0) {
      return src.replace('grindctrl-support-loader.js', 'grindctrl-support-runtime.js');
    }

    // Default: same directory, runtime filename.
    try {
      var u = new URL(src);
      u.pathname = u.pathname.replace(/\/[^/]*$/, '/grindctrl-support-runtime.js');
      return u.toString();
    } catch (e) {
      return '/scripts/grindctrl-support-runtime.js';
    }
  }

  function findAttributeInit() {
    var el = document.currentScript;
    if (!el) {
      // Fall back to a best-effort search.
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var s = scripts[i];
        if (!s) continue;
        if (s.getAttribute && s.getAttribute('data-gc-embed-key')) {
          el = s;
          break;
        }
      }
    }
    if (!el || !el.getAttribute) return null;

    var embedKey = el.getAttribute('data-gc-embed-key');
    if (!embedKey) return null;

    var locale = el.getAttribute('data-gc-locale') || null;
    var debug = el.getAttribute('data-gc-debug');
    var debugBool = debug === 'true' ? true : debug === 'false' ? false : null;

    return {
      embedKey: embedKey,
      locale: locale || undefined,
      debug: debugBool !== null ? debugBool : undefined
    };
  }

  var pending = [];
  var callbacks = [];
  var runtimeApi = null;
  var runtimeLoadPromise = null;
  var runtimeLoaded = false;

  function loadRuntime() {
    if (runtimeLoadPromise) return runtimeLoadPromise;

    runtimeLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.async = true;
      script.src = getRuntimeSrc();
      script.onload = function () { runtimeLoaded = true; resolve(); };
      script.onerror = function () { reject(new Error('runtime_load_failed')); };
      document.head.appendChild(script);
    }).catch(function (err) {
      warn('Failed to load runtime.');
      throw err;
    });

    return runtimeLoadPromise;
  }

  function flush() {
    if (!runtimeApi) return;

    // Callbacks should see the API object.
    for (var i = 0; i < callbacks.length; i++) {
      try { callbacks[i](api); } catch (e) {}
    }
    callbacks = [];

    for (var j = 0; j < pending.length; j++) {
      try { runtimeApi.push(pending[j]); } catch (e2) {}
    }
    pending = [];
  }

  function attach(apiImpl) {
    runtimeApi = apiImpl;
    // Replace public method implementations with runtime.
    var methods = ['init', 'open', 'close', 'toggle', 'destroy', 'updateContext', 'identify', 'track', 'getVersion', 'push',
      // Back-compat aliases
      'updateConfig', 'setContext', 'identifyUser', 'trackEvent'
    ];
    for (var i = 0; i < methods.length; i++) {
      var name = methods[i];
      if (typeof apiImpl[name] === 'function') {
        api[name] = apiImpl[name].bind(apiImpl);
      }
    }
    flush();
  }

  var api = {
    version: LOADER_VERSION,
    __attachRuntime: attach,
    init: function (config) {
      api.push(config);
      return api;
    },
    push: function (item) {
      if (typeof item === 'function') {
        callbacks.push(item);
      } else {
        pending.push(item);
      }

      if (runtimeApi) {
        flush();
        return;
      }

      loadRuntime().then(function () {
        // runtime will call __attachRuntime
      }).catch(function () {
        // Intentionally no UI.
      });
    },
    open: function () { warn('Widget not ready. Call init() first.'); },
    close: function () { warn('Widget not ready. Call init() first.'); },
    toggle: function () { warn('Widget not ready. Call init() first.'); },
    destroy: function () { /* no-op */ },
    updateContext: function () { warn('Widget not ready. Call init() first.'); },
    identify: function () { warn('Widget not ready. Call init() first.'); },
    track: function () { /* no-op */ },
    getVersion: function () { return LOADER_VERSION; },

    // Back-compat aliases (filled once runtime attaches)
    updateConfig: function () { warn('Widget not ready. Call init() first.'); },
    setContext: function () { warn('Widget not ready. Call init() first.'); },
    identifyUser: function () { warn('Widget not ready. Call init() first.'); },
    trackEvent: function () { /* no-op */ }
  };

  // If user queued before script load, adopt that queue.
  var existing = window.GrindctrlSupport;
  if (Array.isArray(existing)) {
    for (var i = 0; i < existing.length; i++) pending.push(existing[i]);
  }

  // Publish API
  window.GrindctrlSupport = api;
  window[GLOBAL_KEY] = api;

  // Attribute-based init
  var attrInit = findAttributeInit();
  if (attrInit) api.push(attrInit);

  // If we already have queued items, start loading runtime.
  if (pending.length > 0 || callbacks.length > 0) {
    api.push(function () {});
  }
})(window, document);
