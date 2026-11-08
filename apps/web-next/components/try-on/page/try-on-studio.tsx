'use client';

/* The public /try-on page, site v15: piece + photo = look.

   Two ways to a look. A sample photo shows the stored look for that piece
   at once: a real engine output made earlier on the sample model, so there
   is nothing to wait for and nothing pretended. An uploaded photo goes
   through the real pipeline (session, attempt, generate, poll) in
   lib/try-on/client.ts. Changing the piece or the photo mid-way aborts the
   request, and a late answer is ignored. */

import * as React from 'react';
import { ShopifyMark } from '@/components/brand-marks';
import { BackgroundWiring } from '@/components/site/background-wiring';
import { CalendarIcon, ExtIcon, SparkleIcon } from '@/components/site/icons';
import { applyDocumentLocale, LanguageSwitch } from '@/components/site/language-switch';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { SkipLink } from '@/components/site/skip-link';
import { useTryOnLocale } from '@/components/try-on/locale-provider';
import { trackClick, trackMarketingEvent } from '@/lib/analytics';
import { BOOKING_URL } from '@/lib/booking';
import { runPublicTryOn, type PublicTryOnFailure } from '@/lib/try-on/client';
import { shopperFailureMessage } from '@/lib/try-on/shopper-errors';
import { readPhotoAsDataUrl } from '@/lib/try-on/photo-file';
import { recordTryOnOpen } from '@/lib/try-on/performance';
import type { TryOnLocale } from '@/lib/try-on/i18n';
import { makingProgress } from '@/lib/try-on/making-progress';
import type { TryOnStage } from '@/lib/try-on/types';
import { CompareDialog, PiecePicker } from './studio-dialogs';
import {
  ActionBar,
  DEMO_STORE_URL,
  Joiner,
  Journey,
  LookCard,
  LooksTray,
  PhotoCard,
  PieceCard,
  stepStatus,
} from './studio-parts';
import {
  comparePair,
  currentLook,
  INITIAL_STATE,
  journeyStep,
  PIECES,
  studioReducer,
  validateUpload,
  type PieceKey,
} from './studio-state';
import { StoreStrip } from './store-strip';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Brings the look card into view if less than 80% of it is showing. */
function focusLookCard(card: HTMLElement | null) {
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const vh = window.innerHeight || 800;
  const seen = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
  if (seen >= Math.min(rect.height, vh) * 0.8) return;
  card.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: rect.height > vh - 100 ? 'start' : 'center',
  });
}

function failureText(failure: PublicTryOnFailure | null, locale: TryOnLocale): string | null {
  if (!failure) return null;
  if (failure.kind === 'unavailable') return shopperFailureMessage('service_unavailable', locale);
  if (failure.kind === 'rate_limited') return shopperFailureMessage('busy', locale);
  return shopperFailureMessage(failure.kind, locale);
}

export function TryOnStudio({ typicalSeconds = null }: { typicalSeconds?: number | null }) {
  React.useEffect(() => { recordTryOnOpen(); }, []);
  const { t, locale, toggleLocale } = useTryOnLocale();
  const [state, dispatch] = React.useReducer(studioReducer, INITIAL_STATE);
  const [progress, setProgress] = React.useState<{ request: number; stage: TryOnStage | null; elapsedMs: number }>({ request: -1, stage: null, elapsedMs: 0 });
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [compareOpen, setCompareOpen] = React.useState(false);
  /* Set when a 429 arrives; clears itself once its Retry-After has passed. */
  const [retryLock, setRetryLock] = React.useState<{ ms: number } | null>(null);
  const [pieceSwaps, setPieceSwaps] = React.useState(0);
  const lookCardRef = React.useRef<HTMLElement>(null);
  const startedAt = React.useRef(0);

  const look = currentLook(state);
  const journey = journeyStep(state);

  /* Time moves the estimate; only the async job moves the stages. */
  React.useEffect(() => {
    if (state.stage !== 'creating') return;
    const request = state.request;
    const timer = window.setInterval(() => {
      setProgress((current) => ({
        request,
        stage: current.request === request ? current.stage : null,
        elapsedMs: Math.max(0, performance.now() - startedAt.current),
      }));
    }, 250);
    return () => window.clearInterval(timer);
  }, [state.stage, state.request]);

  /* The real pipeline for an uploaded photo. A new request number (piece
     or photo changed) aborts this one through the cleanup. */
  React.useEffect(() => {
    if (state.stage !== 'creating' || state.photo?.kind !== 'upload') return;
    const request = state.request;
    const controller = new AbortController();
    runPublicTryOn({
      productId: PIECES[state.piece].productId,
      photoDataUrl: state.photo.dataUrl,
      signal: controller.signal,
      onProgress: (job) => {
        if (!controller.signal.aborted && job.stage) {
          setProgress({ request, stage: job.stage, elapsedMs: Math.max(0, performance.now() - startedAt.current) });
        }
      },
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.ok) {
          dispatch({ type: 'generated', request, image: result.resultImageUrl });
          trackMarketingEvent({
            name: 'storefront.demo_completed',
            properties: { demo: 'try_on', durationMs: Math.round(performance.now() - startedAt.current) },
          });
        } else {
          if (result.failure.kind === 'rate_limited') setRetryLock({ ms: result.failure.retryAfterMs });
          dispatch({ type: 'failed', request, failure: result.failure });
        }
      })
      .catch(() => {
        // Aborted: the piece or photo changed, so this answer no longer applies.
      });
    return () => controller.abort();
    // The request number captures every input that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.request, state.stage]);

  /* Try again waits out a 429's Retry-After. */
  React.useEffect(() => {
    if (!retryLock) return;
    const timer = window.setTimeout(() => setRetryLock(null), Math.max(0, retryLock.ms) + 20);
    return () => window.clearTimeout(timer);
  }, [retryLock]);

  /* The newest look is what the visitor sees. */
  React.useEffect(() => {
    if (state.stage !== 'creating' && state.stage !== 'done' && state.stage !== 'failed') return;
    const timer = window.setTimeout(() => focusLookCard(lookCardRef.current), 60);
    return () => window.clearTimeout(timer);
  }, [state.stage, state.showing]);

  const onCreate = () => {
    startedAt.current = performance.now();
    trackMarketingEvent({ name: 'storefront.demo_started', properties: { demo: 'try_on' } });
    const sample = state.photo?.kind === 'sample';
    dispatch({ type: 'create' });
    if (sample) {
      trackMarketingEvent({ name: 'storefront.demo_completed', properties: { demo: 'try_on', durationMs: 0 } });
    }
  };

  const onFile = async (file: File) => {
    const problem = validateUpload(file);
    if (problem) {
      dispatch({ type: 'rejectFile', reason: problem });
      return;
    }
    try {
      dispatch({ type: 'setUpload', dataUrl: await readPhotoAsDataUrl(file) });
    } catch {
      dispatch({ type: 'rejectFile', reason: 'type' });
    }
  };

  const onPick = (piece: PieceKey) => {
    setPickerOpen(false);
    if (piece !== state.piece) setPieceSwaps((n) => n + 1);
    dispatch({ type: 'pickPiece', piece });
  };

  const onSwitchLocale = () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    toggleLocale();
    applyDocumentLocale(next);
  };

  const retryLocked = state.failure?.kind === 'rate_limited' && retryLock !== null;
  const waiting = makingProgress({
    elapsedMs: progress.request === state.request ? progress.elapsedMs : 0,
    estimateSeconds: typicalSeconds,
    stepCount: t.pageProgressStages.length,
    stage: progress.request === state.request ? progress.stage : null,
  });
  const pair = comparePair(state);

  const storeLinkTracked = () => trackClick('cta_clicked', { cta: 'open_store', section: 'try_on_header' });

  const lookShown = state.stage === 'done' && look !== null;
  const mobileActions = (
    <ActionBar
      t={t}
      state={state}
      look={look}
      canCompare={state.looks.length >= 2}
      createLocked={retryLocked}
      onCreate={onCreate}
      onTryAnother={() => setPickerOpen(true)}
      onCompare={() => setCompareOpen(true)}
    />
  );

  return (
    <>
      <SkipLink />
      <SiteHeader
        locale={locale}
        copy={{
          brandHome: t.brandHome,
          mainNav: t.pageStepsLabel,
          signIn: '',
          bookCall: '',
          menu: '',
          openMenu: '',
          closeMenu: '',
        }}
        nav={[]}
        menuItems={[]}
        showSignIn={false}
        tag={{ icon: <SparkleIcon size={15} />, label: t.pageTag, onPhone: true }}
        middle={
          <div className="hidden lg:block">
            <Journey t={t} current={journey} variant="header" />
          </div>
        }
        onSwitchLocale={onSwitchLocale}
        desktopEnd={
          <a
            href={DEMO_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={storeLinkTracked}
            className="inline-flex h-11 items-center gap-[7px] whitespace-nowrap rounded-full border border-border px-4 text-sm font-semibold text-foreground hover:bg-foreground/[0.06]"
          >
            <ShopifyMark monochrome decorative className="size-4" />
            {t.pageDemoStore}
            <ExtIcon size={14} strokeWidth={2} />
          </a>
        }
        phoneEnd={
          <>
            <LanguageSwitch locale={locale} onSwitch={onSwitchLocale} className="h-11" />
            <a
              href={DEMO_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.pageOpenStore}
              onClick={storeLinkTracked}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground"
            >
              <ShopifyMark monochrome decorative className="size-[18px]" />
            </a>
          </>
        }
      />

      <div className="relative">
        <BackgroundWiring trace={t.pageTrace} lane={false} />
        <main id="main" tabIndex={-1} className="relative z-[1] pb-11 pt-[82px] outline-none sm:pt-24 lg:pb-[60px] lg:pt-[124px]">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[560px] lg:max-w-none">
              {/* Phones: the journey gets its own panel. */}
              <div className="mx-0.5 mb-[26px] mt-1 hidden rounded-[22px] border border-secondary bg-card/70 px-3 pb-3 pt-3.5 sm:block lg:hidden">
                <Journey t={t} current={journey} variant="panel" />
              </div>

              <div className="text-center lg:flex lg:items-end lg:justify-between lg:gap-[30px] lg:text-start">
                <div>
                  <h1 className="text-[24px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[30px] lg:text-[44px]">{t.pageTitle}</h1>
                  <p className="mt-2 hidden text-[15px] leading-normal text-muted-foreground sm:block lg:mt-2.5 lg:text-[16.5px]">
                    {t.pageSubtitle}
                  </p>
                </div>
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackClick('cta_clicked', { cta: 'book_call', section: 'try_on_header' })}
                  className="hidden h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold text-gc-text-2 hover:bg-foreground/[0.06] lg:inline-flex"
                >
                  <CalendarIcon size={16} />
                  {t.pageForStores}
                </a>
              </div>

              {/* On desktop the cards are centred on the look card, the tallest:
                  its 520px stage, 44px head, 10px padding and 1px border each
                  side. The row starts at that height so a slow connection that
                  paints the row before the look card has arrived doesn't drop
                  the other cards when it lands. */}
              <div className="mt-3 flex flex-col gap-2 sm:mt-[26px] lg:mt-[30px] lg:grid lg:min-h-[586px] lg:grid-cols-[260px_48px_260px_48px_minmax(0,1fr)] lg:items-center lg:gap-0 xl:grid-cols-[300px_56px_300px_56px_minmax(0,1fr)]">
                <PieceCard t={t} piece={state.piece} swapKey={pieceSwaps} onChange={() => setPickerOpen(true)} />
                <Joiner glyph="plus" busy={state.stage === 'creating'} />
                <PhotoCard
                  t={t}
                  state={state}
                  onFile={onFile}
                  onUseSample={() => dispatch({ type: 'useSample' })}
                  onClear={() => dispatch({ type: 'clearPhoto' })}
                  status={stepStatus(2, journey)}
                />
                {/* Phones: Create sits with the inputs; once a look exists its
                    actions move under it, where the eye already is. */}
                {!lookShown ? <div className="lg:hidden">{mobileActions}</div> : null}
                <Joiner glyph="equals" busy={state.stage === 'creating'} />
                <LookCard
                  t={t}
                  state={state}
                  look={look}
                  progress={waiting}
                  serverStage={progress.request === state.request ? progress.stage : null}
                  status={stepStatus(4, journey)}
                  failureMessage={failureText(state.failure, locale)}
                  retryLocked={retryLocked}
                  onRetry={onCreate}
                  onUseSample={() => dispatch({ type: 'useSample' })}
                  onView={(view) => dispatch({ type: 'setView', view })}
                  cardRef={lookCardRef}
                />
                {lookShown ? <div className="mt-1 lg:hidden">{mobileActions}</div> : null}
              </div>

              <div className="mt-5 hidden lg:mt-[22px] lg:block">
                <ActionBar
                  t={t}
                  state={state}
                  look={look}
                  canCompare={state.looks.length >= 2}
                  createLocked={retryLocked}
                  onCreate={onCreate}
                  onTryAnother={() => setPickerOpen(true)}
                  onCompare={() => setCompareOpen(true)}
                />
              </div>

              <LooksTray t={t} state={state} onShow={(id) => dispatch({ type: 'showLook', id })} />
              <StoreStrip t={t} />

              <p className="mt-[26px] text-center text-xs text-muted-foreground lg:mt-[30px] lg:text-[12.5px]">
                {t.pageSampleNote}
              </p>
            </div>
          </div>
        </main>
      </div>

      <SiteFooter
        locale={locale}
        links={[
          { id: 'home', label: t.footerHome, href: '/' },
          { id: 'pricing', label: t.pagePricing, href: '/pricing' },
        ]}
        onSwitchLocale={onSwitchLocale}
        copy={{
          brandHome: t.brandHome,
          footerNav: t.pageFooterNav,
          copyright: t.pageCopyright,
          copyrightShort: t.pageCopyrightShort,
        }}
        withLauncherSpacing
      />

      <PiecePicker t={t} open={pickerOpen} onOpenChange={setPickerOpen} current={state.piece} onPick={onPick} />
      <CompareDialog t={t} open={compareOpen} onOpenChange={setCompareOpen} pair={pair} />
    </>
  );
}
