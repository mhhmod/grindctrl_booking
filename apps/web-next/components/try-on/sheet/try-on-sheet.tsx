'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { useTryOnLocale } from '../locale-provider';
import type { ResultControls } from '../try-on-result';
import { useTryOnFlow } from '../use-try-on-flow';
import { SheetPhotoStep } from './sheet-photo-step';
import { SheetCheckStep } from './sheet-check-step';
import { SheetMakingStep } from './sheet-making-step';
import { SheetResultStep } from './sheet-result-step';
import { makingProgress } from '@/lib/try-on/making-progress';
import { parseStoreProduct, type StoreProduct } from '@/lib/try-on/store-product';
import { detectInAppBrowser, storePageUrl } from '@/lib/try-on/in-app-browser';
import { useMediaQuery } from './use-media-query';
import { phoneStore } from '@/lib/try-on/phone-store';
import { getSheetCopy, type ArabicAddressForm } from '@/lib/try-on/sheet-copy';

/* The v16 try-on inside the sheet (02-try-on.md), for a store whose
   v16_tryon flag is on: the photo step, the on-phone check and the
   consent, making the look, and the look itself. It makes a look exactly
   as today's embed does, through the same flow. */
export function TryOnSheet({
  product,
  variantId,
  variantTitle,
  shop,
  lookSeconds,
  addressForm,
  loadingSteps,
  loadingStyle,
  result,
}: {
  product: { handle: string; name: string; imageUrl: string };
  variantId?: string;
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
  });
  // One polite region for the whole sheet, so each step and the ready
  // moment are announced once.
  const announcement = making ? steps[progress.stepIndex] : flow.step === 'result' ? copy.lookReady : '';

  const variantLine = variantTitle && variantTitle !== 'Default Title' ? variantTitle.split(' / ').join(' · ') : '';

  if (privacyOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPrivacyOpen(false)}
            aria-label={copy.back}
            className="grid size-11 place-items-center rounded-full hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
          </button>
          <h2 className="text-lg font-semibold text-foreground">{copy.privacyTitle}</h2>
        </div>
        {copy.privacyBody.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className={`mx-auto flex min-h-[calc(100dvh-3rem)] w-full flex-col gap-5 ${flow.step === 'result' ? 'max-w-4xl' : 'max-w-xl'}`}>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {flow.step !== 'result' && (
        <header className="flex items-center gap-3">
          {product.imageUrl && (
            // The store's own product image, already on Shopify's CDN.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{product.name}</p>
            {variantLine && <p className="truncate text-sm text-muted-foreground">{copy.variantLine(variantLine)}</p>}
          </div>
        </header>
      )}

      {flow.sessionState === 'error' && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-foreground">{t.storefrontProofErrorTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{flow.sessionError}</p>
          <button type="button" onClick={flow.retrySession} className="mt-3 text-sm font-medium underline underline-offset-2">
            {t.refreshTryOn}
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {flow.step === 'upload' && phoneRead && (
          <SheetPhotoStep
            copy={copy}
            t={t}
            lookSeconds={lookSeconds}
            inApp={inApp}
            storeLink={storeLink}
            canTakePhoto={touchScreen || inApp !== null}
            onPhoto={selectPhoto}
            onShowPrivacy={() => setPrivacyOpen(true)}
          />
        )}

        {flow.step === 'consent' && flow.photoDataUrl && (
          <SheetCheckStep
            copy={copy}
            photoDataUrl={flow.photoDataUrl}
            firstTime={firstTime}
            keepOnPhone={keepOnPhone}
            busy={flow.sessionState !== 'ready'}
            onKeepOnPhone={changeKeep}
            onDifferentPhoto={flow.clearPhoto}
            onTryOn={() => void tryOn()}
            onShowPrivacy={() => setPrivacyOpen(true)}
          />
        )}

        {making && (
          <SheetMakingStep
            copy={copy}
            photoDataUrl={flow.photoDataUrl}
            piece={product}
            steps={steps}
            progress={progress}
            loadingStyle={loadingStyle}
          />
        )}

        {flow.step === 'result' && flow.job && (
          <SheetResultStep
            copy={copy}
            t={t}
            locale={locale}
            job={flow.job}
            photoDataUrl={flow.photoDataUrl}
            productName={product.name}
            storeProduct={storeProduct}
            triedVariantId={variantId}
            fallbackVariantTitle={variantTitle}
            controls={result}
            madeInSeconds={flow.generationSeconds}
            onChangePhoto={flow.reset}
          />
        )}

        {flow.step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            {flow.unavailable ? (
              <p role="status" className="text-lg font-semibold text-foreground">
                {t.tryOnUnavailable}
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">{t.errorTitle}</p>
                  <p className="text-sm text-muted-foreground">{flow.error}</p>
                </div>
                <button type="button" onClick={flow.reset} className="rounded-xl border px-4 py-2 text-sm font-medium">
                  {t.tryAgain}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
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
