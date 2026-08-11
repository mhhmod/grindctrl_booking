'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useMotionValue, animate, motion, useReducedMotion } from 'framer-motion';

type InfiniteSliderProps = {
  children: React.ReactNode;
  gap?: number;
  duration?: number;
  durationOnHover?: number;
  direction?: 'horizontal' | 'vertical';
  reverse?: boolean;
  className?: string;
};

/* Upstream measures the track with react-use-measure (a thin wrapper over
   ResizeObserver). In this deployment ResizeObserver reliably reports the
   right size the moment you call getBoundingClientRect() on it, but its own
   "initial" notification — the one the spec promises fires as soon as
   observe() is called — never arrived; width stayed 0 forever and the
   marquee sat frozen. A native window "resize" event always forced a
   correct re-measure, which is what exposed this as ResizeObserver's
   delivery being unreliable here rather than anything about the DOM or the
   element being observed. Measuring synchronously on mount, then using
   ResizeObserver + a resize listener only for updates after that, sidesteps
   the unreliable part entirely instead of depending on it. */
function useTrackSize(): [(node: HTMLDivElement | null) => void, number, number] {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    elRef.current = node;
  }, []);

  return [setRef, size.width, size.height];
}

export function InfiniteSlider({
  children,
  gap = 16,
  duration = 25,
  durationOnHover,
  direction = 'horizontal',
  reverse = false,
  className,
}: InfiniteSliderProps) {
  const [currentDuration, setCurrentDuration] = useState(duration);
  const [ref, width, height] = useTrackSize();
  const translation = useMotionValue(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [key, setKey] = useState(0);
  /* CSS marquees stop under prefers-reduced-motion for free via a media
     query. This one drives its transform from JS, so nothing here would
     ever consult that setting on its own — checked explicitly instead, and
     the track holds still and stays readable rather than travelling. */
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    let controls;
    const size = direction === 'horizontal' ? width : height;
    const contentSize = size + gap;
    const from = reverse ? -contentSize / 2 : 0;
    const to = reverse ? 0 : -contentSize / 2;

    if (isTransitioning) {
      controls = animate(translation, [translation.get(), to], {
        ease: 'linear',
        duration:
          currentDuration * Math.abs((translation.get() - to) / contentSize),
        onComplete: () => {
          setIsTransitioning(false);
          setKey((prevKey) => prevKey + 1);
        },
      });
    } else {
      controls = animate(translation, [from, to], {
        ease: 'linear',
        duration: currentDuration,
        repeat: Infinity,
        repeatType: 'loop',
        repeatDelay: 0,
        onRepeat: () => {
          translation.set(from);
        },
      });
    }

    return controls?.stop;
  }, [
    key,
    translation,
    currentDuration,
    width,
    height,
    gap,
    isTransitioning,
    direction,
    reverse,
    reducedMotion,
  ]);

  const hoverProps = durationOnHover
    ? {
        onHoverStart: () => {
          setIsTransitioning(true);
          setCurrentDuration(durationOnHover);
        },
        onHoverEnd: () => {
          setIsTransitioning(true);
          setCurrentDuration(duration);
        },
      }
    : {};

  return (
    <div className={cn('overflow-hidden', className)}>
      <div ref={ref} className="w-max">
        <motion.div
          className="flex w-max"
          style={{
            ...(direction === 'horizontal'
              ? { x: translation }
              : { y: translation }),
            gap: `${gap}px`,
            flexDirection: direction === 'horizontal' ? 'row' : 'column',
          }}
          {...hoverProps}
        >
          {children}
          {/* Seamless loop needs the content twice; hidden from assistive
              tech so a screen reader is not told about each item twice.
              Upstream renders `{children}{children}` bare — this repo has an
              existing duplicate-content convention (see the marquee this
              replaced) and the frontend rule here requires preserving
              accessibility. */}
          <span className="contents" aria-hidden="true">
            {children}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
