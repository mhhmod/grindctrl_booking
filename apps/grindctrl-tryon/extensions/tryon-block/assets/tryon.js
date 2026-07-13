/* GrindCTRL Try-On block: button styling comes from the GrindCTRL config
   API (dashboard-editable); clicking expands an iframe to the GrindCTRL
   embed inline. Height auto-syncs via postMessage from the embed. */
(function () {
  function applyConfig(root, btn, base, shop) {
    fetch(base + '/api/try-on/config?shop=' + encodeURIComponent(shop || ''))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cfg) {
        if (!cfg) return;
        if (cfg.buttonLabel) btn.textContent = cfg.buttonLabel;
        if (cfg.accentBg) btn.style.background = cfg.accentBg;
        if (cfg.accentFg) btn.style.color = cfg.accentFg;
        if (typeof cfg.radiusPx === 'number') btn.style.borderRadius = cfg.radiusPx + 'px';
        if (cfg.widgetTheme) root.dataset.theme = root.dataset.theme || cfg.widgetTheme;
      })
      .catch(function () { /* defaults from CSS/schema stay */ });
  }

  function mount(root) {
    var btn = root.querySelector('.gc-tryon-btn');
    if (!btn) return;

    var base = (root.dataset.embedBase || 'https://grindctrl.cloud').replace(/\/+$/, '');
    applyConfig(root, btn, base, root.dataset.shop);

    btn.addEventListener('click', function () {
      var existing = root.querySelector('iframe');
      if (existing) {
        existing.style.display = existing.style.display === 'none' ? '' : 'none';
        return;
      }

      var locale = (root.dataset.locale || 'en').slice(0, 2);
      var src =
        base +
        '/embed/try-on?product=' +
        encodeURIComponent(root.dataset.product || '') +
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

      window.addEventListener('message', function (event) {
        if (
          event.data &&
          event.data.type === 'grindctrl-tryon:height' &&
          typeof event.data.height === 'number'
        ) {
          frame.style.height = event.data.height + 'px';
        }
      });

      root.appendChild(frame);
    });
  }

  var roots = document.querySelectorAll('.gc-tryon-root');
  for (var i = 0; i < roots.length; i++) mount(roots[i]);
})();
