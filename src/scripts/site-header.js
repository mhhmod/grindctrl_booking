/* ================================================================
   Site Header & Navigation
   Wires up the Shoelace drawer and page navigation.
   ================================================================ */

(function () {
  var drawer = document.getElementById('nav-drawer');
  var hamburgerBtn = document.getElementById('hamburger-btn');

  // Open drawer on hamburger click
  if (hamburgerBtn && drawer) {
    hamburgerBtn.addEventListener('click', function () {
      drawer.show();
    });
  }

  // Close drawer when a link inside is clicked
  if (drawer) {
    drawer.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (link) {
        drawer.hide();
      }
    });
  }

  // Highlight active nav link based on page hash
  function updateActiveNav(page) {
    var navLinks = document.querySelectorAll('.nav-link[data-nav]');
    var drawerLinks = document.querySelectorAll('.drawer-link[data-nav]');
    navLinks.forEach(function (l) {
      l.classList.toggle('active', l.dataset.nav === page || (l.dataset.nav === 'packages' && page === 'home'));
    });
    drawerLinks.forEach(function (l) {
      var isActive = l.dataset.nav === page || (l.dataset.nav === 'packages' && page === 'home');
      l.classList.toggle('text-on-surface', isActive);
      l.classList.toggle('bg-surface-container-high', isActive);
      l.classList.toggle('text-secondary', !isActive);
    });
  }

  // Listen for hash changes to update active state
  window.addEventListener('hashchange', function () {
    var hash = location.hash.replace('#', '') || 'home';
    if (hash === 'packages' || hash === 'ai-trainer' || hash === 'workspace') hash = 'home';
    updateActiveNav(hash);
  });

  // Expose for the main navigation system
  window.__updateActiveNav = updateActiveNav;
})();
