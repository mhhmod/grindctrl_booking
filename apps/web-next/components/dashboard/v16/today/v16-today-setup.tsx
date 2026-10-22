'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Progress } from '@mantine/core';
import { GcIcon } from '@/components/icons';
import { BOOKING_URL } from '@/lib/booking';
import type { LaunchActionResult, PreviewLinkResult } from '@/app/dashboard/try-on/launch-actions';
import { getTodaySetupCopy, type TodaySetupCopy } from '@/lib/dashboard/today-setup-copy';
import type { SetupStep, SetupStepKey, TodaySetupView } from '@/lib/dashboard/today-setup-model';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import classes from './v16-today-setup.module.css';

/* The v16 Today while a store is being set up (04-dashboard.md, the
   Today-Setup board): the checklist, each step ticked from the store's own
   signals (lib/dashboard/today-setup-model.ts), and a way to book help.
   Steps not done yet stay open; a finished step folds to its title and can
   be opened again. The page checks again whenever it regains focus, so a
   merchant who saved their theme in another tab comes back to a ticked
   step. Going live leaves this page for Today. */

export type TodaySetupActions = {
  setLaunchState: (input: { shop: string; state: 'preview' | 'live' | 'holdout' }) => Promise<LaunchActionResult>;
  createPreviewLink: (input: { shop: string }) => Promise<PreviewLinkResult>;
};

/** Checks on focus at most this often. */
const REFOCUS_CHECK_MS = 10_000;

function Marker({ step, current, copy }: { step: SetupStep; current: boolean; copy: TodaySetupCopy }) {
  if (step.done) {
    return (
      <span className={classes.marker} data-state="done">
        <GcIcon name="check" size={16} />
        <span className={classes.srOnly}>{copy.done}</span>
      </span>
    );
  }
  return (
    <span className={classes.marker} data-state={current ? 'current' : 'todo'} aria-hidden="true">
      {step.number}
    </span>
  );
}

export function V16TodaySetup({
  view,
  locale,
  shop,
  actions,
}: {
  view: TodaySetupView;
  locale: SiteLocale;
  shop: string;
  actions: TodaySetupActions;
}) {
  const copy = getTodaySetupCopy(locale);
  const router = useRouter();
  const id = React.useId();
  const [checking, startCheck] = React.useTransition();
  const [busy, startAction] = React.useTransition();
  const [failed, setFailed] = React.useState<SetupStepKey | null>(null);
  const [reopened, setReopened] = React.useState<SetupStepKey[]>([]);

  React.useEffect(() => {
    let last = 0;
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < REFOCUS_CHECK_MS) return;
      last = Date.now();
      router.refresh();
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [router]);

  function checkAgain() {
    startCheck(() => router.refresh());
  }

  function openStore() {
    setFailed(null);
    // Opened at once, so the browser does not block it as a pop-up, then
    // pointed at the signed link.
    const tab = window.open('about:blank', '_blank');
    startAction(async () => {
      const result = await actions.createPreviewLink({ shop });
      if (result.ok) {
        if (tab) {
          tab.opener = null;
          tab.location.href = result.url;
        } else {
          window.location.href = result.url;
        }
      } else {
        tab?.close();
        setFailed('tryIt');
      }
    });
  }

  function goLive(state: 'live' | 'holdout') {
    setFailed(null);
    startAction(async () => {
      const result = await actions.setLaunchState({ shop, state });
      if (result.ok) router.refresh();
      else setFailed('goLive');
    });
  }

  function toggle(key: SetupStepKey) {
    setReopened((keys) => (keys.includes(key) ? keys.filter((other) => other !== key) : [...keys, key]));
  }

  function body(step: SetupStep) {
    switch (step.key) {
      case 'theme':
        return (
          <>
            <ul className={classes.pieces}>
              {view.pieces.map((piece) => (
                <li key={piece.key} className={classes.piece}>
                  {piece.ready && (
                    <span className={classes.ready}>
                      <GcIcon name="check" size={14} />
                      {copy.ready}
                    </span>
                  )}
                  <span className={classes.pieceName}>{piece.name}</span>
                  {!piece.ready && piece.href && (
                    <a href={piece.href} target="_blank" rel="noopener noreferrer" className={classes.link}>
                      {copy.openThemeEditor}
                      <GcIcon name="ext" size={14} />
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <div className={classes.buttons}>
              <Button
                component="a"
                href={view.addButtonHref}
                target="_blank"
                rel="noopener noreferrer"
                radius="pill"
                rightSection={<GcIcon name="ext" size={14} />}
              >
                {copy.addButton}
              </Button>
              <Button variant="default" radius="pill" leftSection={<GcIcon name="refresh" size={16} />} loading={checking} onClick={checkAgain}>
                {copy.checkAgain}
              </Button>
            </div>
            <p className={classes.hint}>{copy.addButtonHint}</p>
          </>
        );
      case 'tryIt':
        return (
          <div className={classes.split}>
            <p className={classes.text}>
              {copy.tryItBody} <span className={classes.strong}>{copy.testFree}</span>
            </p>
            <Button variant="default" radius="pill" disabled={busy} onClick={openStore}>
              {copy.openStore}
            </Button>
          </div>
        );
      case 'goLive':
        return (
          <div className={classes.split}>
            <p className={classes.text}>{view.holdoutAvailable ? copy.goLiveBody : copy.onlyYou}</p>
            <div className={classes.buttons}>
              <Button radius="pill" disabled={busy} onClick={() => goLive('live')}>
                {copy.goLive}
              </Button>
              {view.holdoutAvailable && (
                <Button variant="default" radius="pill" disabled={busy} onClick={() => goLive('holdout')}>
                  {copy.halfTest}
                </Button>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className={classes.page}>
      <section aria-labelledby={`${id}-title`} className={`${classes.card} ${classes.checklist}`}>
        <div className={classes.head}>
          <div className={classes.headRow}>
            <h2 id={`${id}-title`} className={classes.h2}>
              {view.title}
            </h2>
            <span className={classes.left}>{view.stepsLeft}</span>
          </div>
          <Progress value={view.progress} size={6} radius="pill" color="brand" aria-label={`${view.title}: ${view.stepsLeft}`} />
        </div>
        <ol className={classes.steps}>
          {view.steps.map((step) => {
            const current = step.key === view.current;
            const content = body(step);
            // A finished step folds to its title; Store connected has nothing more to show.
            const foldable = step.done && content !== null;
            const open = content !== null && (!step.done || reopened.includes(step.key));
            const bodyId = `${id}-${step.key}`;
            return (
              <li key={step.key} className={classes.step} data-current={current || undefined}>
                <Marker step={step} current={current} copy={copy} />
                <div className={classes.main}>
                  <h3 className={classes.stepTitle}>
                    {foldable ? (
                      <button type="button" className={classes.fold} aria-expanded={open} aria-controls={bodyId} onClick={() => toggle(step.key)}>
                        {step.title}
                        <GcIcon name={open ? 'up' : 'down'} size={16} />
                      </button>
                    ) : (
                      step.title
                    )}
                  </h3>
                  {step.line && <p className={classes.text}>{step.line}</p>}
                  {open && (
                    <div id={bodyId} className={classes.body}>
                      {content}
                    </div>
                  )}
                  {failed === step.key && (
                    <p role="alert" className={classes.error}>
                      {copy.failed}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <aside className={classes.aside}>
        <section aria-labelledby={`${id}-stuck`} className={`${classes.card} ${classes.stuck}`}>
          <span className={classes.stuckIcon} aria-hidden="true">
            <GcIcon name="spark" size={18} />
          </span>
          <div className={classes.stuckText}>
            <h2 id={`${id}-stuck`} className={classes.stuckTitle}>
              {copy.stuck}
            </h2>
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={classes.link}>
              {copy.book}
            </a>
          </div>
        </section>
      </aside>
    </div>
  );
}
