'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/* Shared reveal for the ambient-loop landing cards (render receipt, ops
   chain, messaging channels): adds `.in-view` once the card is scrolled
   into range, which is what un-pauses their CSS keyframe loops (see the
   `animation-play-state` rules in globals.css). Reduced-motion visitors get
   the class immediately — same rule ai-vision-figure.tsx follows: they see
   the settled state, never a stuck mid-animation frame. */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.classList.add('in-view');
        return;
      }

      ScrollTrigger.create({
        trigger: el,
        start: 'top 82%',
        once: true,
        onEnter: () => el.classList.add('in-view'),
      });
    },
    { scope: ref },
  );

  return ref;
}
