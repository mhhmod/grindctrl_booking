'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';

/**
 * Runs inside the /embed/try-on iframe:
 * - forces the theme requested by the host page (?theme=light|dark)
 * - reports content height to the parent so the iframe can auto-size
 */
export function EmbedFrameBridge({ theme }: { theme: 'light' | 'dark' }) {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

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
