/* Kept as plain JavaScript so the exact code tested here also runs before
   hydration, without a client bundle or a transpiler helper dependency. */
export const BROWSER_RESILIENCE_SCRIPT = String.raw`(() => {
  if (window.__gcBrowserResilience) return;
  window.__gcBrowserResilience = true;

  // next-themes accepts raw persisted strings and uses them as class tokens.
  // Old/corrupt values must be cleared before its first client render.
  const cleanTheme = () => {
    try {
      const theme = localStorage.getItem('theme');
      if (theme !== null && theme !== 'light' && theme !== 'dark') {
        localStorage.removeItem('theme');
        return true;
      }
    } catch {}
    return false;
  };
  cleanTheme();
  window.addEventListener('storage', (event) => {
    if (event.storageArea && event.storageArea !== localStorage) return;
    if (event.key !== 'theme' || event.newValue === null ||
        event.newValue === 'light' || event.newValue === 'dark') return;
    cleanTheme();
    // Prevent next-themes consuming an invalid token from another tab.
    event.stopImmediatePropagation();
    window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: null }));
  }, true);

  const proto = Node.prototype;
  const removeChild = proto.removeChild;
  const insertBefore = proto.insertBefore;
  let warned = false;
  const warn = () => {
    if (warned) return;
    warned = true;
    console.warn('[GRINDCTRL] Recovered a text node replaced by browser translation.');
  };
  // Chrome Translate replaces React-owned Text nodes with nested <font>s.
  // Tolerate only that displaced-text case; other DOM mistakes still throw.
  // A boundary alone cannot recover a commit failure without losing the story,
  // and disabling translation would exclude visitors who need it.
  const displaced = (parent, node) => node && node.nodeType === Node.TEXT_NODE &&
    node.parentNode !== parent && parent.nodeType === Node.ELEMENT_NODE &&
    parent.querySelector('font');
  proto.removeChild = function(child) {
    if (displaced(this, child)) {
      warn();
      return child;
    }
    return removeChild.call(this, child);
  };
  proto.insertBefore = function(child, reference) {
    if (displaced(this, reference)) {
      warn();
      return this.appendChild(child);
    }
    return insertBefore.call(this, child, reference);
  };
})();`;
