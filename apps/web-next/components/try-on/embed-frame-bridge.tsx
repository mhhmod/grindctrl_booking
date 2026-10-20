'use client';

import { useEffect } from 'react';

/**
 * Runs inside the /embed/try-on iframe: reports content height to the
 * parent so the iframe can auto-size. Theme is server-rendered. Inside the
 * v16 sheet (`sheet=1`), Escape asks the store's page to close the sheet,
 * since a key pressed in here never reaches it.
 */
export function EmbedFrameBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    if (new URLSearchParams(window.location.search).get('sheet') !== '1') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.parent.postMessage({ type: 'grindctrl-tryon:close' }, '*');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (window.parent === window) return;

    const report = () => {
      window.parent.postMessage(
        { type: 'grindctrl-tryon:height', height: document.documentElement.scrollHeight },
        '*',
      );
    };

    report();
    const observer = new ResizeObserver(report);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return null;
}
