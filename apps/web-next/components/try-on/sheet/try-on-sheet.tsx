'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { useTryOnLocale } from '../locale-provider';
import type { ResultControls } from '../try-on-result';
import { useTryOnFlow } from '../use-try-on-flow';
import { SheetPhotoStep } from './sheet-photo-step';
import { SheetCheckStep } from './sheet-check-step';
import { SheetMakingStep } from './sheet-making-step';
import { SheetResultStep } from './sheet-result-step';
import { SheetChrome, SheetLayout } from './sheet-layout';
import { makingProgress, type MakingProgress } from '@/lib/try-on/making-progress';
import { parseStoreProduct, type StoreProduct } from '@/lib/try-on/store-product';
import { detectInAppBrowser, storePageUrl, type InAppBrowser } from '@/lib/try-on/in-app-browser';
import { useMediaQuery } from './use-media-query';
import { phoneStore } from '@/lib/try-on/phone-store';
import { getSheetCopy, type ArabicAddressForm, type SheetCopy } from '@/lib/try-on/sheet-copy';
import type { TryOnLocale, TryOnTranslator } from '@/lib/try-on/i18n';

type SheetProduct = { handle: string; name: string; imageUrl: string };

/* The v16 try-on inside the sheet (02-try-on.md), for a store whose
   v16_tryon flag is on: the photo step, the on-phone check and the
   consent, making the look, and the look itself. It makes a look exactly
   as today's embed does, through the same flow. */
export function TryOnSheet({
  product,
  variantId,
  displayVariantId,
  variantTitle,
  shop,
  lookSeconds,
  addressForm,
  loadingSteps,
  loadingStyle,
  result,
}: {
  product: SheetProduct;
  variantId?: string;
  /** Presentation only; the flow keeps the signed variantId. */
  displayVariantId?: string;
  /** "Black / M", from the store's own variant names. */
  variantTitle?: string;
  shop?: string;
  lookSeconds: number | null;
  addressForm: ArabicAddressForm;
  loadingSteps?: string[];
  loadingStyle?: 'steps' | 'pulse' | 'bar';
  result?: ResultControls;
}) {
  const { t, locale } = useTryOnLocale();
  const copy = getSheetCopy(locale, addressForm);
  const flow = useTryOnFlow({
    product: { id: product.handle, name: product.name },
    shopProduct: product,
    displayShop: shop,
    variantId,
    t,
  });
  const { selectPhoto } = flow;
  const storeProduct = useStoreProduct();
  // Read in the browser only; the server render has neither.
  const userAgent = useSyncExternalStore(noSubscription, () => navigator.userAgent, () => '');
  const referrer = useSyncExternalStore(noSubscription, () => document.referrer, () => '');
  const inApp = detectInAppBrowser(userAgent);
  /* A computer's file picker ignores the camera hint, and the in-sheet
     camera is not built yet, so Take a photo shows only on touch screens. */
  const touchScreen = useMediaQuery('(pointer: coarse)', true);
  const storeLink = inApp ? storePageUrl({ referrer, shop, handle: product.handle, variantId }) : null;

  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [firstTime, setFirstTime] = useState(true);
  const [keepOnPhone, setKeepOnPhone] = useState(true);
  // Nothing shows until the phone has been read, so a kept photo never
  // flashes the photo step first.
  const [phoneRead, setPhoneRead] = useState(false);

  /* What this phone already holds: the consent, the keep setting, and a
     photo kept from an earlier look, which skips the photo step. */
  useEffect(() => {
    let live = true;
    const store = phoneStore();
    void Promise.all([store.hasConsent(), store.keepOnPhone(), store.photo()]).then(([consented, keep, kept]) => {
      if (!live) return;
      setFirstTime(!consented);
      setKeepOnPhone(keep);
      if (keep && kept) selectPhoto(kept);
      setPhoneRead(true);
    });
    return () => {
      live = false;
    };
  }, [selectPhoto]);

  const changeKeep = useCallback((on: boolean) => {
    setKeepOnPhone(on);
    // Turning it off deletes what the phone kept (phone-store.ts).
    void phoneStore().setKeepOnPhone(on);
  }, []);

  const tryOn = useCallback(async () => {
    const store = phoneStore();
    if (firstTime) {
      await store.rememberConsent();
      setFirstTime(false);
    }
    if (keepOnPhone && flow.photoDataUrl) await store.keepPhoto(flow.photoDataUrl);
    void flow.generate();
  }, [firstTime, flow, keepOnPhone]);

  const making = flow.step === 'generating';
  const now = useNow(making);
  const steps = loadingSteps?.length ? loadingSteps : copy.makingSteps;
  const progress = makingProgress({
    elapsedMs: flow.generationStartedAt === null ? 0 : now - flow.generationStartedAt,
    estimateSeconds: lookSeconds,
    stepCount: steps.length,
    stage: flow.serverStage,
    acceptedElapsedMs: flow.acceptedAt == null ? null : Math.max(0, now - flow.acceptedAt),
  });

  return (
    <TryOnSheetView
      copy={copy}
      t={t}
      locale={locale}
      product={product}
      variantTitle={variantTitle}
      lookSeconds={lookSeconds}
      inApp={inApp}
      storeLink={storeLink}
      canTakePhoto={touchScreen || inApp !== null}
      phoneRead={phoneRead}
      privacyOpen={privacyOpen}
      onPrivacyOpenChange={setPrivacyOpen}
      firstTime={firstTime}
      keepOnPhone={keepOnPhone}
      onKeepOnPhone={changeKeep}
      onTryOn={() => void tryOn()}
      flow={flow}
      steps={steps}
      progress={progress}
      loadingStyle={loadingStyle}
      storeProduct={storeProduct}
      triedVariantId={displayVariantId || variantId}
      result={result}
    />
  );
}

/** What the sheet's view reads from the try-on flow. */
export type SheetFlow = Pick<
  ReturnType<typeof useTryOnFlow>,
  | 'step'
  | 'photoDataUrl'
  | 'sessionState'
  | 'sessionError'
  | 'job'
  | 'error'
  | 'unavailable'
  | 'challengeFailed'
  | 'generationSeconds'
  | 'selectPhoto'
  | 'acceptPhoto'
  | 'clearPhoto'
  | 'generate'
  | 'retrySession'
  | 'reset'
  | 'forget'
  | 'discardBrokenLook'
>;

/* Every state of the sheet, from state alone, in one shell per state: the
   product pinned at the top, the state's content as the one scrolling body,
   and its action pinned at the bottom (SheetLayout). The dev fixture
   (app/dev/sheet-scroll-check) renders this directly. */
export function TryOnSheetView({
  copy,
  t,
  locale,
  product,
  variantTitle,
  lookSeconds,
  inApp,
  storeLink,
  canTakePhoto,
  phoneRead,
  privacyOpen,
  onPrivacyOpenChange,
  firstTime,
  keepOnPhone,
  onKeepOnPhone,
  onTryOn,
  flow,
  steps,
  progress,
  loadingStyle,
  storeProduct,
  triedVariantId,
  result,
  initialResultView,
  photoTips,
}: {
  copy: SheetCopy;
  t: TryOnTranslator;
  locale: TryOnLocale;
  product: SheetProduct;
  variantTitle?: string;
  lookSeconds: number | null;
  inApp: InAppBrowser | null;
  storeLink: string | null;
  canTakePhoto: boolean;
  phoneRead: boolean;
  privacyOpen: boolean;
  onPrivacyOpenChange: (open: boolean) => void;
  firstTime: boolean;
  keepOnPhone: boolean;
  onKeepOnPhone: (on: boolean) => void;
  onTryOn: () => void;
  flow: SheetFlow;
  steps: string[];
  progress: MakingProgress;
  loadingStyle?: 'steps' | 'pulse' | 'bar';
  storeProduct: StoreProduct | null;
  triedVariantId?: string;
  result?: ResultControls;
  initialResultView?: 'look' | 'photo';
  photoTips?: string[];
}) {
  const making = flow.step === 'generating';
  // One polite region for the whole sheet, so each step and the ready
  // moment are announced once.
  const announcement = making ? (progress.overEstimate ? copy.makingAlmostThere : steps[progress.stepIndex]) : flow.step === 'result' ? copy.lookReady : '';
  const variantLine = variantTitle && variantTitle !== 'Default Title' ? variantTitle.split(' / ').join(' · ') : '';
  const showPrivacy = () => onPrivacyOpenChange(true);

  const header = (
    <header className="flex items-center gap-3">
      {product.imageUrl && (
        // The store's own product image, already on Shopify's CDN.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover short:size-10" />
      )}
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-foreground">{product.name}</p>
        {variantLine && <p className="truncate text-sm text-muted-foreground">{copy.variantLine(variantLine)}</p>}
      </div>
    </header>
  );

  const notice =
    flow.sessionState === 'error' && flow.step !== 'result' && !privacyOpen ? (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="font-medium text-foreground">{t.storefrontProofErrorTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{flow.sessionError}</p>
        <button type="button" onClick={flow.retrySession} className="mt-1 min-h-11 text-sm font-medium underline underline-offset-2">
          {t.refreshTryOn}
        </button>
      </div>
    ) : null;

  let content: ReactNode = null;
  if (privacyOpen) {
    content = (
      <SheetLayout>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPrivacyOpenChange(false)}
            aria-label={copy.back}
            className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
          </button>
          <h2 className="text-lg font-semibold text-foreground">{copy.privacyTitle}</h2>
        </div>
        <div className="space-y-4">
          {copy.privacyBody.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </SheetLayout>
    );
  } else if (flow.step === 'upload' && phoneRead) {
    content = (
      <SheetPhotoStep
        copy={copy}
        t={t}
        lookSeconds={lookSeconds}
        inApp={inApp}
        storeLink={storeLink}
        canTakePhoto={canTakePhoto}
        onPhoto={flow.selectPhoto}
        onShowPrivacy={showPrivacy}
        tips={photoTips}
      />
    );
  } else if (flow.step === 'consent' && flow.photoDataUrl) {
    content = (
      <SheetCheckStep
        copy={copy}
        photoDataUrl={flow.photoDataUrl}
        firstTime={firstTime}
        keepOnPhone={keepOnPhone}
        busy={flow.sessionState !== 'ready'}
        onKeepOnPhone={onKeepOnPhone}
        onAccepted={flow.acceptPhoto}
        onDifferentPhoto={flow.clearPhoto}
        onTryOn={onTryOn}
        onShowPrivacy={showPrivacy}
      />
    );
  } else if (making) {
    content = (
      <SheetMakingStep copy={copy} photoDataUrl={flow.photoDataUrl} piece={product} steps={steps} progress={progress} loadingStyle={loadingStyle} />
    );
  } else if (flow.step === 'result' && flow.job) {
    content = (
      <SheetResultStep
        copy={copy}
        t={t}
        locale={locale}
        job={flow.job}
        photoDataUrl={flow.photoDataUrl}
        productName={product.name}
        productImageUrl={product.imageUrl || undefined}
        storeProduct={storeProduct}
        triedVariantId={triedVariantId}
        fallbackVariantTitle={variantTitle}
        controls={result}
        madeInSeconds={flow.generationSeconds}
        initialView={initialResultView}
        onChangePhoto={flow.reset}
        onForget={() => void flow.forget()}
        onImageError={() => void flow.discardBrokenLook()}
      />
    );
  } else if (flow.step === 'error') {
    content = <SheetErrorState flow={flow} t={t} />;
  }

  return (
    <SheetChrome header={header} notice={notice} closeLabel={copy.close}>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {content ?? <SheetLayout />}
    </SheetChrome>
  );
}

function SheetErrorState({ flow, t }: { flow: SheetFlow; t: TryOnTranslator }) {
  const retry = flow.unavailable
    ? null
    : flow.challengeFailed
      ? // A fresh check with the same photo and garment.
        { label: t.challengeRetry, onClick: () => void flow.generate() }
      : { label: t.tryAgain, onClick: flow.reset };
  return (
    <SheetLayout
      footer={
        retry && (
          <button
            type="button"
            onClick={retry.onClick}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {retry.label}
          </button>
        )
      }
    >
      <div className="my-auto flex flex-col items-center gap-4 py-8 text-center short:py-2">
        <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
        {flow.unavailable ? (
          <p role="status" className="text-lg font-semibold text-foreground">
            {t.tryOnUnavailable}
          </p>
        ) : flow.challengeFailed ? (
          <div role="alert" className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{t.challengeFailedTitle}</p>
            <p className="text-sm text-muted-foreground">{t.challengeFailedBody}</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">{t.errorTitle}</p>
            <p className="text-sm text-muted-foreground">{flow.error}</p>
          </div>
        )}
      </div>
    </SheetLayout>
  );
}

/** The time now, ticking only while something is counting. */
function useNow(active: boolean, everyMs = 500): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    // Until the first tick the clock reads before the start, which counts as the start.
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [active, everyMs]);
  return now;
}

/** The store's own product, asked of the loader once (item 19). Only the
 *  page holding this frame may answer, and what it sends is checked field
 *  by field; it is shown, never trusted for anything else. */
function useStoreProduct(): StoreProduct | null {
  const [product, setProduct] = useState<StoreProduct | null>(null);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== 'grindctrl-tryon:product') return;
      const parsed = parseStoreProduct(event.data.product);
      if (parsed) setProduct(parsed);
    };
    window.addEventListener('message', onMessage);
    if (window.parent !== window) window.parent.postMessage({ type: 'grindctrl-tryon:product-request' }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return product;
}

function noSubscription(): () => void {
  return () => {};
}
