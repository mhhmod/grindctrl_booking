'use client';

import React from 'react';
import { WhatsAppMark, InstagramMark, FacebookMark } from '@/components/brand-marks';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { useScrollReveal } from '@/lib/landing/use-scroll-reveal';

/* New: no messaging-channel visual existed before. One AI reply branches
   downward to three real channels (official simple-icons marks via
   brand-marks.tsx, not redrawn) instead of crossing the card
   left-to-right -- argues consistency ("one voice"), not just coverage.
   Hover or focus a channel to swap "Replied" for the "Tone checked"
   confirmation. Styling lives in globals.css (.gcmv-*). */
export function MessagingChannels({ className }: { className?: string }) {
  const { t } = useLandingLocale();
  const ref = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={ref} className={`gcmv-card ${className ?? ''}`} role="group" aria-label={t.messagingAlt}>
      <div className="gcmv-scene">
        <div className="gcmv-head">
          <p className="gcmv-kicker">{t.messagingKicker}</p>
          <p className="gcmv-title">{t.messagingTitle}</p>
        </div>

        <div className="gcmv-reply">
          <small>{t.messagingReplyLabel}</small>
          <p>{t.messagingReplyText}</p>
        </div>

        <div className="gcmv-route" aria-hidden="true">
          <svg className="gcmv-lines" viewBox="0 0 440 330">
            <path className="gcmv-path" d="M220 174C190 181 139 199 89 223" />
            <path className="gcmv-path" d="M220 174C220 190 220 205 220 223" />
            <path className="gcmv-path" d="M220 174C250 181 301 199 351 223" />
            <circle className="gcmv-particle gcmv-particle-one" cx="0" cy="0" r="2.8" />
            <circle className="gcmv-particle gcmv-particle-two" cx="0" cy="0" r="2.8" />
            <circle className="gcmv-particle gcmv-particle-three" cx="0" cy="0" r="2.8" />
          </svg>
        </div>

        <div className="gcmv-channels">
          <div className="gcmv-channel gcmv-whatsapp" role="group" tabIndex={0}>
            <span className="gcmv-icon">
              <span className="gcmv-ring" aria-hidden="true" />
              <WhatsAppMark />
            </span>
            <strong>WhatsApp</strong>
            <small>
              <span className="gcmv-status">{t.messagingStatusReplied}</span>
              <span className="gcmv-detail">{t.messagingStatusDetail}</span>
            </small>
          </div>

          <div className="gcmv-channel gcmv-instagram" role="group" tabIndex={0}>
            <span className="gcmv-icon">
              <span className="gcmv-ring" aria-hidden="true" />
              <InstagramMark />
            </span>
            <strong>Instagram</strong>
            <small>
              <span className="gcmv-status">{t.messagingStatusReplied}</span>
              <span className="gcmv-detail">{t.messagingStatusDetail}</span>
            </small>
          </div>

          <div className="gcmv-channel gcmv-facebook" role="group" tabIndex={0}>
            <span className="gcmv-icon">
              <span className="gcmv-ring" aria-hidden="true" />
              <FacebookMark />
            </span>
            <strong>Facebook</strong>
            <small>
              <span className="gcmv-status">{t.messagingStatusReplied}</span>
              <span className="gcmv-detail">{t.messagingStatusDetail}</span>
            </small>
          </div>
        </div>

        <div className="gcmv-foot">
          <strong>{t.messagingFootStrong}</strong> {t.messagingFootRest}
        </div>
      </div>
    </div>
  );
}
