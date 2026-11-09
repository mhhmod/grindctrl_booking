'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  CheckCircle,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoUpload } from './photo-upload';
import { TryOnResult, type ResultControls } from './try-on-result';
import { useTryOnLocale } from './locale-provider';
import { getDefaultProduct, getProduct } from '@/lib/try-on/products';
import { localizeProduct } from '@/lib/try-on/i18n';
import { pollTryOnJob } from '@/lib/try-on/client';
import { useTryOnFlow } from './use-try-on-flow';
import { SheetMakingStep } from './sheet/sheet-making-step';
import { makingProgress } from '@/lib/try-on/making-progress';
import { getSheetCopy } from '@/lib/try-on/sheet-copy';

// Kept exported from here for the embed's existing tests.
export { pollTryOnJob };

export type TryOnDemoOverrides = {
  generateLabel?: string;
  loadingSteps?: string[];
  loadingStyle?: 'steps' | 'pulse' | 'bar';
  result?: ResultControls;
};

export type ShopProductOverride = {
  /** Product handle from the host store. */
  handle: string;
  name: string;
  /** Garment image URL (Shopify CDN). */
  imageUrl: string;
};

export function TryOnDemo({
  productId,
  shop: displayShop,
  variantId,
  shopProduct,
  overrides,
  lookSeconds = null,
}: {
  productId?: string;
  /** Display/settings context only. Billing authority comes from the signed capability. */
  shop?: string;
  variantId?: string;
  shopProduct?: ShopProductOverride;
  overrides?: TryOnDemoOverrides;
  lookSeconds?: number | null;
} = {}) {
  const { t, locale } = useTryOnLocale();
  const baseProduct = (productId && getProduct(productId)) || getDefaultProduct();
  const product = shopProduct
    ? {
        id: shopProduct.handle,
        name: shopProduct.name,
        category: '',
        imageUrl: shopProduct.imageUrl,
        details: [],
      }
    : localizeProduct(baseProduct, locale);
  const sheetCopy = getSheetCopy(locale);
  const loadingSteps = overrides?.loadingSteps?.length ? overrides.loadingSteps : sheetCopy.makingSteps;
  const loadingStyle = overrides?.loadingStyle ?? 'steps';
  const generateLabel = overrides?.generateLabel || t.generateBtn;

  const {
    step,
    photoDataUrl,
    generationStartedAt,
    serverStage,
    job,
    error,
    unavailable,
    challengeFailed,
    sessionState,
    sessionError,
    selectPhoto,
    clearPhoto,
    generate,
    retrySession,
    reset,
    forget,
    discardBrokenLook,
  } = useTryOnFlow({ product, shopProduct, displayShop, variantId, t });
  const handleFileSelected = useCallback((_file: File, dataUrl: string) => selectPhoto(dataUrl), [selectPhoto]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (step !== 'generating') return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [step]);
  const progress = makingProgress({
    elapsedMs: generationStartedAt === null ? 0 : now - generationStartedAt,
    estimateSeconds: lookSeconds,
    stepCount: loadingSteps.length,
    stage: serverStage,
  });
  const announcement = progress.overEstimate ? sheetCopy.makingAlmostThere : loadingSteps[progress.stepIndex];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10">
      {/* ─── Product showcase ─── */}
      <div className="gc-fade-in-up flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        {product.imageUrl ? (
          <div className="relative shrink-0 overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={240}
              height={320}
              className="aspect-[3/4] w-48 object-cover sm:w-60"
              priority
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-start">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {product.category}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {product.name}
          </h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {product.details.map((d) => (
              <li key={d} className="flex items-center gap-2">
                <CheckCircle className="size-3.5 shrink-0 text-primary" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─── Flow area ─── */}
      {/* Shorter minimum on mobile: 420px on a short viewport (or with the
          keyboard open during upload) forced scroll for no reason — this
          just needs to be tall enough that switching steps doesn't jump. */}
      <div className="gc-fade-in-up min-h-[280px] rounded-2xl border p-6 sm:min-h-[420px] sm:p-8 gc-landing-card" style={{ animationDelay: '0.1s' }}>
        {sessionState === 'loading' && step !== 'result' && (
          <p className="mb-5 text-sm text-muted-foreground" role="status" aria-live="polite">
            {t.preparingSession}
          </p>
        )}
        {sessionState === 'error' && step !== 'result' && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert">
            <p className="font-medium text-foreground">{t.storefrontProofErrorTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{sessionError}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={retrySession}>
              {t.refreshTryOn}
            </Button>
          </div>
        )}
        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                {t.uploadTitle}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t.uploadSubtitle(product.name)}
              </p>
            </div>
            <PhotoUpload
              onFileSelected={handleFileSelected}
              onFileClear={clearPhoto}
              previewUrl={photoDataUrl}
            />
          </div>
        )}

        {/* Step: Consent */}
        {step === 'consent' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                {t.consentTitle}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t.consentSubtitle}
              </p>
            </div>

            {/* Photo preview (small) */}
            <div className="flex items-center gap-4">
              {photoDataUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoDataUrl}
                  alt={t.photoLabel}
                  className="size-20 shrink-0 rounded-lg border object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {product.name}
                </p>
                <p className="text-xs text-muted-foreground">{t.photoReady}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPhoto}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {t.changePhoto}
              </Button>
            </div>

            {/* Privacy notice */}
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">{t.privacyLabel}</span>{' '}
                  {t.privacyText}
                </p>
                <p>
                  <span className="font-medium text-foreground">{t.noteLabel}</span>{' '}
                  {t.noteText}
                </p>
              </div>
            </div>

            <Button
              onClick={generate}
              disabled={sessionState !== 'ready'}
              size="lg"
              className="h-12 w-full gap-2 rounded-xl text-sm font-semibold shadow-[0_0_32px_rgba(99,102,241,0.18)]"
              id="tryon-generate-btn"
            >
              <Sparkles className="size-4" />
              {generateLabel}
            </Button>
          </div>
        )}

        {/* Step: Generating (style is merchant-configurable) */}
        {step === 'generating' && (
          <>
            <p role="status" className="sr-only">{announcement}</p>
            <SheetMakingStep
              copy={sheetCopy}
              photoDataUrl={photoDataUrl}
              piece={product}
              steps={loadingSteps}
              progress={progress}
              loadingStyle={loadingStyle}
            />
          </>
        )}
        {/* Step: Result */}
        {step === 'result' && job && (
          <TryOnResult
            job={job}
            productName={product.name}
            shopMode={!!shopProduct}
            controls={overrides?.result}
            onReset={reset}
            onForget={() => void forget()}
            onImageError={() => void discardBrokenLook()}
          />
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            {unavailable ? (
              <h3 className="text-lg font-semibold text-foreground" role="status">
                {t.tryOnUnavailable}
              </h3>
            ) : challengeFailed ? (
              <>
                <div role="alert" className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">{t.challengeFailedTitle}</h3>
                  <p className="text-sm text-muted-foreground">{t.challengeFailedBody}</p>
                </div>
                {/* A fresh check with the same photo and garment. */}
                <Button variant="outline" onClick={() => void generate()} className="rounded-xl" id="tryon-challenge-retry-btn">
                  {t.challengeRetry}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {t.errorTitle}
                  </h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={reset}
                  className="rounded-xl"
                  id="tryon-retry-btn"
                >
                  {t.tryAgain}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
