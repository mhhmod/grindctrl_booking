'use client';

import React, { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

/* Five real clips, one narrative: why this exists, who runs it, how it
   works, what we watch, what we check. Pinned so each beat gets the full
   viewport to land rather than competing with scroll for attention -
   this section is the one deliberately bigger motion moment on the page,
   filling the trust-proof gap left by ENABLE_TESTIMONIALS being off. */
const BEATS = [
  { key: 'vision', src: '/landing/operations/vision.mp4', poster: '/landing/operations/vision-poster.jpg' },
  { key: 'team', src: '/landing/operations/team.mp4', poster: '/landing/operations/team-poster.jpg' },
  { key: 'systems', src: '/landing/operations/systems.mp4', poster: '/landing/operations/systems-poster.jpg' },
  { key: 'monitoring', src: '/landing/operations/monitoring.mp4', poster: '/landing/operations/monitoring-poster.jpg' },
  { key: 'review', src: '/landing/operations/review.mp4', poster: '/landing/operations/review-poster.jpg' },
] as const;

export function OperationsShowcase({
  beats,
}: {
  beats: { title: string; body: string }[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const captionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dotRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Static, fully-visible fallback (and the base state reduced-motion
      // visitors get): a plain stacked list, first video the only one shown.
      gsap.set(videoRefs.current, { opacity: 0 });
      gsap.set(videoRefs.current[0], { opacity: 1 });
      gsap.set(captionRefs.current, { opacity: 0, y: 12 });
      gsap.set(captionRefs.current[0], { opacity: 1, y: 0 });
      gsap.set(dotRefs.current[0], { opacity: 1 });

      // play() isn't guaranteed to return a Promise in every environment
      // (jsdom returns undefined), so the rejection handler can't assume one.
      const safePlay = (video: HTMLVideoElement | null | undefined) => {
        video?.play()?.catch(() => {});
      };

      if (reduced) {
        safePlay(videoRefs.current[0]);
        return;
      }

      const activate = (index: number) => {
        videoRefs.current.forEach((video, i) => {
          if (!video) return;
          if (i === index) safePlay(video);
          else video.pause();
        });
      };
      activate(0);

      const tl = gsap.timeline({
        defaults: { duration: 1, ease: 'power1.inOut' },
        scrollTrigger: {
          trigger: pinRef.current,
          start: 'top top',
          end: `+=${BEATS.length * 100}%`,
          scrub: 1,
          pin: true,
          onUpdate: (self) => {
            const index = Math.min(BEATS.length - 1, Math.floor(self.progress * BEATS.length));
            activate(index);
          },
        },
      });

      BEATS.forEach((_, i) => {
        if (i === 0) return;
        const label = `beat${i}`;
        tl.addLabel(label);
        tl.to(videoRefs.current[i - 1], { opacity: 0 }, label);
        tl.to(videoRefs.current[i], { opacity: 1 }, label);
        tl.to(captionRefs.current[i - 1], { opacity: 0, y: -12 }, label);
        tl.to(captionRefs.current[i], { opacity: 1, y: 0 }, `${label}+=0.2`);
        tl.set(dotRefs.current[i - 1], { opacity: 0.35 }, label);
        tl.set(dotRefs.current[i], { opacity: 1 }, label);
        // Hold each beat readable before the next crossfade starts.
        tl.to({}, { duration: 0.6 });
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef}>
      <div ref={pinRef} className="relative h-[100svh] w-full overflow-hidden">
        {BEATS.map((beat, i) => (
          <video
            key={beat.key}
            ref={(el) => {
              videoRefs.current[i] = el;
            }}
            className="absolute inset-0 h-full w-full object-cover"
            src={beat.src}
            poster={beat.poster}
            muted
            loop
            playsInline
            preload={i === 0 ? 'auto' : 'metadata'}
            aria-hidden="true"
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" aria-hidden="true" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-5 pb-14 sm:pb-20">
          <div className="relative mx-auto h-24 w-full max-w-3xl px-4 sm:h-20 sm:px-6 lg:px-8">
            {beats.map((beat, i) => (
              <div
                key={BEATS[i].key}
                ref={(el) => {
                  captionRefs.current[i] = el;
                }}
                className="absolute inset-x-4 bottom-0 flex flex-col gap-2 text-start sm:inset-x-6 lg:inset-x-8"
              >
                <h3 className="text-[22px] font-bold leading-tight text-white sm:text-3xl">{beat.title}</h3>
                <p className="max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">{beat.body}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 sm:px-6 lg:px-8" aria-hidden="true">
            {BEATS.map((beat, i) => (
              <span
                key={beat.key}
                ref={(el) => {
                  dotRefs.current[i] = el;
                }}
                className="h-1 flex-1 rounded-full bg-white opacity-35 transition-opacity"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
