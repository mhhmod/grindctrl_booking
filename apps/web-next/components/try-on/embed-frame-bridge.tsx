'use client';

import { useEffect } from 'react';

/**
 * Runs inside the /embed/try-on iframe: reports content height to the
 * parent so the iframe can auto-size. Theme is server-rendered.
 */
export function EmbedFrameBridge() {
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
