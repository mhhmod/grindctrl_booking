'use client';

import { useEffect } from 'react';

/* One delegated listener for every .gc-spotlight card: writes the cursor
   position into CSS vars; the glow itself is pure CSS (globals.css). */
export function GcSpotlight() {
  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return;

    const onMove = (e: MouseEvent) => {
      const card = (e.target as Element | null)?.closest?.('.gc-spotlight');
      if (!(card instanceof HTMLElement)) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--gc-mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--gc-my', `${e.clientY - rect.top}px`);
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  return null;
}
