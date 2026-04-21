/* ================================================================
   Site Header / Drawer Coordination
   ================================================================ */

(function () {
  var drawer = document.getElementById('nav-drawer');
  var hamburgerBtn = document.getElementById('hamburger-btn');

  function syncDrawerPlacement() {
    if (!drawer) return;
    var isRtl = (document.documentElement.getAttribute('dir') || 'ltr') === 'rtl';
    drawer.placement = isRtl ? 'start' : 'end';
  }

  function syncHamburgerState() {
    if (!hamburgerBtn || !drawer) return;
    hamburgerBtn.setAttribute('aria-expanded', drawer.open ? 'true' : 'false');
  }

  function updateActiveNav(page) {
    var navLinks = document.querySelectorAll('.nav-link[data-nav]');
    var drawerLinks = document.querySelectorAll('.drawer-link[data-nav], .drawer-link-highlight[data-nav]');

    navLinks.forEach(function (link) {
      link.classList.toggle('active', link.dataset.nav === page || (link.dataset.nav === 'packages' && page === 'home'));
    });

    drawerLinks.forEach(function (link) {
      var isActive = link.dataset.nav === page || (link.dataset.nav === 'packages' && page === 'home');
      link.classList.toggle('text-on-surface', isActive);
      link.classList.toggle('bg-surface-container-high', isActive);
      link.classList.toggle('text-secondary', !isActive);
    });
  }

  if (hamburgerBtn && drawer) {
    hamburgerBtn.addEventListener('click', function () {
      syncDrawerPlacement();
      drawer.show();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && drawer.open) {
        drawer.hide();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 768 && drawer.open) {
        drawer.hide();
      }
    });
  }

  if (drawer) {
    drawer.addEventListener('click', function (event) {
      var targetLink = event.target.closest('a[href^="#"], a[href^="/"]');
      if (targetLink) {
        drawer.hide();
      }
    });

    drawer.addEventListener('sl-initial-focus', function (event) {
      var firstLink = drawer.querySelector('.drawer-link, .drawer-link-highlight, .gc-auth-drawer-cta');
      if (firstLink) {
        event.preventDefault();
        firstLink.focus();
      }
    });

    drawer.addEventListener('sl-after-show', syncHamburgerState);
    drawer.addEventListener('sl-after-hide', syncHamburgerState);
  }

  window.addEventListener('hashchange', function () {
    var hash = location.hash.replace('#', '') || 'home';
    if (hash === 'packages' || hash === 'ai-trainer' || hash === 'workspace') hash = 'home';
    updateActiveNav(hash);
  });

  var htmlObserver = new MutationObserver(function (changes) {
    for (var i = 0; i < changes.length; i += 1) {
      if (changes[i].attributeName === 'dir') {
        syncDrawerPlacement();
        break;
      }
    }
  });

  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['dir'],
  });

  syncDrawerPlacement();
  syncHamburgerState();
  window.__updateActiveNav = updateActiveNav;
})();
