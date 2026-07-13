/* GrindCTRL Try-On block: expands an iframe to the GrindCTRL embed inline
   under the button. Height auto-syncs via postMessage from the embed. */
(function () {
  function mount(root) {
    var btn = root.querySelector('.gc-tryon-btn');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var existing = root.querySelector('iframe');
      if (existing) {
        existing.style.display = existing.style.display === 'none' ? '' : 'none';
        return;
      }

      var base = (root.dataset.embedBase || 'https://grindctrl.cloud').replace(/\/+$/, '');
      var locale = (root.dataset.locale || 'en').slice(0, 2);
      var src =
        base +
        '/embed/try-on?product=' +
        encodeURIComponent(root.dataset.product || '') +
        '&locale=' +
        encodeURIComponent(locale) +
        '&theme=' +
        encodeURIComponent(root.dataset.theme || 'light');

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
