'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { useTryOnLocale } from '../locale-provider';
import { TryOnResult, type ResultControls } from '../try-on-result';
import { useTryOnFlow } from '../use-try-on-flow';
import { SheetPhotoStep } from './sheet-photo-step';
import { SheetCheckStep } from './sheet-check-step';
import { phoneStore } from '@/lib/try-on/phone-store';
import { getSheetCopy, type ArabicAddressForm } from '@/lib/try-on/sheet-copy';

/* The v16 try-on inside the sheet (02-try-on.md), for a store whose
   v16_tryon flag is on. Part two builds the photo step, the on-phone check
   and the consent; making the look and the result are today's until parts
   three and four rebuild them. It makes a look exactly as today's embed
   does, through the same flow. */
export function TryOnSheet({
  product,
  variantId,
  variantTitle,
  shop,
  lookSeconds,
  addressForm,
  loadingSteps,
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
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col gap-5">
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

        {flow.step === 'generating' && (
          <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="size-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary motion-reduce:animate-none" aria-hidden="true" />
            <p className="text-lg font-semibold text-foreground">{t.generatingTitle}</p>
            <p className="text-sm text-muted-foreground">{(loadingSteps?.length ? loadingSteps : t.loadingSteps)[0]}</p>
          </div>
        )}

        {flow.step === 'result' && flow.job && (
          <TryOnResult job={flow.job} productName={product.name} shopMode controls={result} onReset={flow.reset} />
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
