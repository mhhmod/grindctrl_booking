'use client';

import React from 'react';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { useScrollReveal } from '@/lib/landing/use-scroll-reveal';

/* Replaces AiVisionFigure in #proof. Same "one calm figure" restraint that
   component's own history argued for (see its comments — two busier
   versions were rejected as geometric), but the two source particles now
   converge radially into the portrait instead of crossing the card, and the
   figure itself is a new path with a light/mid/shadow gradient for real
   dimensionality instead of a flat fill. Styling lives in globals.css
   (.gcpv-*) so it can be built on var(--card)/var(--card-foreground) and
   respond to the site theme with no extra wiring. */
export function RenderReceiptFigure({ className }: { className?: string }) {
  const { t } = useLandingLocale();
  const ref = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={ref} className={`gcpv-card ${className ?? ''}`} role="img" tabIndex={0} aria-label={t.renderReceiptAlt}>
      <div className="gcpv-scene">
        <div className="gcpv-head">
          <p className="gcpv-kicker">{t.renderReceiptKicker}</p>
          <p className="gcpv-title">{t.renderReceiptTitle}</p>
        </div>

        <div className="gcpv-flow-space" aria-hidden="true">
          <svg className="gcpv-flow" viewBox="0 0 440 330">
            <path className="gcpv-line gcpv-line-one" d="M88 205C104 181 138 160 174 151" />
            <path className="gcpv-line gcpv-line-two" d="M352 205C336 181 302 160 266 151" />
            <circle className="gcpv-particle gcpv-particle-one" cx="0" cy="0" r="3" />
            <circle className="gcpv-particle gcpv-particle-two" cx="0" cy="0" r="3" />
          </svg>
        </div>

        <div className="gcpv-portrait" aria-hidden="true">
          <svg viewBox="0 0 240 220">
            <defs>
              <radialGradient id="gcpv-glow-fill-refined" cx="50%" cy="48%" r="52%">
                <stop className="gcpv-glow-core" offset="0%" />
                <stop className="gcpv-glow-edge" offset="100%" />
              </radialGradient>
              <linearGradient id="gcpv-person-fill-refined" x1="0" y1="0" x2="1" y2="1">
                <stop className="gcpv-person-light" offset="0%" />
                <stop className="gcpv-person-mid" offset="54%" />
                <stop className="gcpv-person-shadow" offset="100%" />
              </linearGradient>
            </defs>
            <ellipse className="gcpv-aura" cx="120" cy="126" rx="105" ry="91" fill="url(#gcpv-glow-fill-refined)" />
            <path
              className="gcpv-person"
              d="M120 28C142 28 158 46 157 72C157 92 149 108 137 118L139 128C140 134 146 138 157 142C180 148 200 160 211 177C217 187 220 198 220 210H20C20 198 23 187 29 177C40 160 60 148 83 142C94 138 100 134 101 128L103 118C91 108 83 92 83 72C82 46 98 28 120 28Z"
            />
          </svg>
        </div>

        <div className="gcpv-source gcpv-photo">
          <small>{t.renderReceiptSourcePhotoLabel}</small>
          <strong>{t.renderReceiptSourcePhotoValue}</strong>
        </div>

        <div className="gcpv-source gcpv-product">
          <small>{t.renderReceiptSourceProductLabel}</small>
          <strong>{t.renderReceiptSourceProductValue}</strong>
        </div>

        <div className="gcpv-receipt">
          <span>{t.renderReceiptLine}</span>
          <small>{t.renderReceiptBadge}</small>
        </div>
      </div>
    </div>
  );
}
