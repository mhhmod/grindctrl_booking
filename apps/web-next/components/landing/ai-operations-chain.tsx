'use client';

import React from 'react';
import { useLandingLocale } from '@/components/landing/landing-locale';
import { useScrollReveal } from '@/lib/landing/use-scroll-reveal';

/* New: nothing like this was live before (the earlier attempt,
   ai-operations-trail.tsx, is dead code — not imported anywhere). One
   particle rides a single continuous route through four checkpoints
   (Capture -> Act -> Check -> Log), each lighting briefly as it passes.
   Only one thing ever moves, deliberately calm. Styling lives in
   globals.css (.gccs-*). Checkpoint 4's label sits above its node rather
   than below (see the comment on .gccs-four there) -- the incoming curve
   and the footer both occupy the space directly below/around it. */
export function AiOperationsChain({ className }: { className?: string }) {
  const { t } = useLandingLocale();
  const ref = useScrollReveal<HTMLDivElement>();
  const [capture, act, check, log] = t.opsChainSteps;

  return (
    <div ref={ref} className={`gccs-card ${className ?? ''}`} role="img" tabIndex={0} aria-label={t.opsChainAlt}>
      <div className="gccs-scene">
        <div className="gccs-head">
          <div>
            <p className="gccs-kicker">{t.opsChainKicker}</p>
            <p className="gccs-title">{t.opsChainTitle}</p>
          </div>
          <span className="gccs-live">
            <i aria-hidden="true" />
            {t.opsChainLiveLabel}
          </span>
        </div>

        <div className="gccs-route" aria-hidden="true">
          <svg className="gccs-map" viewBox="0 0 440 330">
            <path
              className="gccs-track"
              d="M52 124C105 95 169 107 213 117C289 134 348 126 356 166C363 205 303 211 246 214C191 217 177 231 179 255"
            />
            <circle className="gccs-node gccs-node-one" cx="52" cy="124" r="5" />
            <circle className="gccs-node gccs-node-two" cx="213" cy="117" r="5" />
            <circle className="gccs-node gccs-node-three" cx="356" cy="166" r="5" />
            <circle className="gccs-node gccs-node-four" cx="179" cy="255" r="5" />
            <circle className="gccs-particle" cx="0" cy="0" r="3.2" />
          </svg>
        </div>

        <div className="gccs-stage gccs-one">
          <small>{capture.title}</small>
          <strong>{capture.body}</strong>
        </div>
        <div className="gccs-stage gccs-two">
          <small>{act.title}</small>
          <strong>{act.body}</strong>
        </div>
        <div className="gccs-stage gccs-three">
          <small>{check.title}</small>
          <strong>{check.body}</strong>
        </div>
        <div className="gccs-stage gccs-four">
          <small>{log.title}</small>
          <strong>{log.body}</strong>
        </div>

        <div className="gccs-foot">
          <strong>{t.opsChainFootStrong}</strong> {t.opsChainFootRest}
        </div>
      </div>
    </div>
  );
}
