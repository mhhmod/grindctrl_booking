'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  CheckCircle,
  ScanLine,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhotoUpload } from './photo-upload';
import { TryOnResult, type ResultControls } from './try-on-result';
import { useTryOnLocale } from './locale-provider';
import { getDefaultProduct, getProduct } from '@/lib/try-on/products';
import { localizeProduct } from '@/lib/try-on/i18n';
import type {
  TryOnApiResponse,
  TryOnJob,
  TryOnJobApiResponse,
  TryOnSession,
} from '@/lib/try-on/types';

type DemoStep = 'upload' | 'consent' | 'generating' | 'result' | 'error';
type GenerationPhase =
  | 'session-requested'
  | 'session-created'
  | 'generation-requested'
  | 'result-received';

const SLOW_GENERATION_MS = 12_000;

const GENERATION_PHASE_PROGRESS: Record<GenerationPhase, number> = {
  'session-requested': 25,
  'session-created': 50,
  'generation-requested': 75,
  'result-received': 100,
};

const GENERATION_PHASE_STEP: Record<GenerationPhase, number> = {
  'session-requested': 0,
  'session-created': 1,
  'generation-requested': 2,
  'result-received': Number.POSITIVE_INFINITY,
};

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
  shop,
  shopProduct,
  overrides,
}: {
  productId?: string;
  shop?: string;
  shopProduct?: ShopProductOverride;
  overrides?: TryOnDemoOverrides;
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
  const loadingSteps = overrides?.loadingSteps?.length ? overrides.loadingSteps : t.loadingSteps;
  const loadingStyle = overrides?.loadingStyle ?? 'steps';
  const generateLabel = overrides?.generateLabel || t.generateBtn;

  const [step, setStep] = useState<DemoStep>('upload');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [generationPhase, setGenerationPhase] =
    useState<GenerationPhase>('session-requested');
  const [isSlowGeneration, setIsSlowGeneration] = useState(false);
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadingStepIdx = Math.min(
    GENERATION_PHASE_STEP[generationPhase],
    loadingSteps.length - 1,
  );
  const currentLoadingLabel = loadingSteps[loadingStepIdx] ?? t.generatingTitle;
  // Keep the long-wait copy merchant-controlled and localized without widening
  // this component's settings contract. The final configured step becomes the
  // calm fallback message while progress itself stays on the last real signal.
  const slowLoadingLabel = loadingSteps.at(-1) ?? currentLoadingLabel;

  useEffect(() => {
    if (step !== 'generating' || generationPhase !== 'generation-requested') return;

    const slowTimer = window.setTimeout(() => {
      setIsSlowGeneration(true);
    }, SLOW_GENERATION_MS);

    return () => window.clearTimeout(slowTimer);
  }, [generationPhase, step]);

  const handleFileSelected = useCallback((_file: File, dataUrl: string) => {
    setPhotoDataUrl(dataUrl);
    setStep('consent');
    setError(null);
  }, []);

  const handleFileClear = useCallback(() => {
    setPhotoDataUrl(null);
    setStep('upload');
    setError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    setStep('generating');
    setGenerationPhase('session-requested');
    setIsSlowGeneration(false);
    setError(null);

    try {
      // 1. Create session
      const sessionRes = await fetch('/api/try-on/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, shop }),
      });
      const sessionData: TryOnApiResponse<TryOnSession> = await sessionRes.json();

      if (!sessionData.ok || !sessionData.data) {
        throw new Error(sessionData.error || t.genericError);
      }

      setGenerationPhase('session-created');

      // 2. Generate try-on
      const generationRequest = fetch('/api/try-on/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionData.data.sessionId,
          productId: product.id,
          shop: sessionData.data.shop,
          photoSource: 'upload',
          photoReference: photoDataUrl ? 'uploaded-photo' : undefined,
          photoData: photoDataUrl ?? undefined,
          garmentUrl: shopProduct?.imageUrl,
          productName: shopProduct?.name,
        }),
      });
      setGenerationPhase('generation-requested');

      const genRes = await generationRequest;
      const genData: TryOnJobApiResponse = await genRes.json();

      if (
        !genData.ok ||
        !genData.jobId ||
        !genData.status ||
        !genData.productId ||
        !genData.meta ||
        genData.status === 'failed' ||
        !genData.resultImageUrl
      ) {
        throw new Error(genData.message || genData.error || t.genericError);
      }

      setGenerationPhase('result-received');

      setJob({
        jobId: genData.jobId,
        sessionId: sessionData.data.sessionId,
        productId: genData.productId,
        shop: sessionData.data.shop,
        status: genData.status,
        resultImageUrl: genData.resultImageUrl,
        message: genData.message,
        createdAt: new Date().toISOString(),
        meta: genData.meta,
      });
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
      setStep('error');
    }
  }, [photoDataUrl, product.id, shop, shopProduct, t]);

  const handleReset = useCallback(() => {
    setPhotoDataUrl(null);
    setJob(null);
    setError(null);
    setGenerationPhase('session-requested');
    setIsSlowGeneration(false);
    setStep('upload');
  }, []);

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
              onFileClear={handleFileClear}
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
                onClick={handleFileClear}
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
              onClick={handleGenerate}
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
          <div
            className="flex flex-col items-center gap-6 py-8"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            {loadingStyle === 'pulse' && product.imageUrl ? (
              <div className="relative isolate">
                <span
                  aria-hidden="true"
                  className="absolute -inset-3 rounded-2xl border border-primary/25 motion-safe:animate-[gc-tryon-processing-ring_3.6s_ease-out_infinite] motion-reduce:opacity-30"
                />
                <div className="relative overflow-hidden rounded-xl border bg-muted/20 shadow-[0_18px_50px_-28px_color-mix(in_oklch,var(--primary)_55%,transparent)] motion-safe:animate-[gc-tryon-processing-breathe_3.8s_cubic-bezier(0.45,0,0.2,1)_infinite]">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    width={160}
                    height={213}
                    className="aspect-[3/4] w-32 object-cover"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(180deg,transparent_36%,color-mix(in_oklch,var(--primary)_44%,transparent)_49%,transparent_62%)] motion-safe:animate-[gc-tryon-processing-scan_2.8s_cubic-bezier(0.4,0,0.2,1)_infinite] motion-reduce:hidden"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent"
                  />
                </div>
              </div>
            ) : loadingStyle !== 'bar' ? (
              <div className="relative grid size-20 place-items-center">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full border border-primary/25 motion-safe:animate-[gc-tryon-processing-ring_3.6s_ease-out_infinite] motion-reduce:opacity-30"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-3 rounded-full bg-primary/15 blur-xl motion-safe:animate-[gc-tryon-processing-breathe_3.8s_cubic-bezier(0.45,0,0.2,1)_infinite]"
                />
                <div className="relative grid size-14 place-items-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10 shadow-[0_14px_40px_-24px_color-mix(in_oklch,var(--primary)_65%,transparent)]">
                  <ScanLine className="size-6 text-primary" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(180deg,transparent_36%,color-mix(in_oklch,var(--primary)_48%,transparent)_49%,transparent_62%)] motion-safe:animate-[gc-tryon-processing-scan_2.8s_cubic-bezier(0.4,0,0.2,1)_infinite] motion-reduce:hidden"
                  />
                </div>
              </div>
            ) : null}

            <div className="w-full space-y-4 text-center">
              <h3 className="text-lg font-semibold text-foreground">
                {t.generatingTitle}
              </h3>

              {loadingStyle === 'steps' ? (
                <div className="mx-auto max-w-sm space-y-1.5 text-start">
                  {loadingSteps.map((label, idx) => (
                    <div
                      key={`${idx}-${label}`}
                      aria-current={idx === loadingStepIdx ? 'step' : undefined}
                      className={`flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-[color,background-color] duration-200 ${
                        idx < loadingStepIdx
                          ? 'text-primary/80'
                          : idx === loadingStepIdx
                            ? 'bg-primary/5 font-medium text-foreground'
                            : 'text-muted-foreground/35'
                      }`}
                    >
                      {idx < loadingStepIdx ? (
                        <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
                      ) : idx === loadingStepIdx ? (
                        <span className="relative grid size-4 shrink-0 place-items-center" aria-hidden="true">
                          <span className="absolute inset-0 rounded-full border border-primary/45 motion-safe:animate-[gc-tryon-processing-ring_2.8s_ease-out_infinite] motion-reduce:opacity-40" />
                          <span className="size-1.5 rounded-full bg-primary" />
                        </span>
                      ) : (
                        <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">
                          <span className="size-1 rounded-full bg-muted-foreground/25" />
                        </span>
                      )}
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mx-auto max-w-sm space-y-3">
                  {loadingStyle === 'bar' && (
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={GENERATION_PHASE_PROGRESS[generationPhase]}
                      aria-valuetext={isSlowGeneration ? slowLoadingLabel : currentLoadingLabel}
                    >
                      <div
                        className="h-full rounded-full bg-primary shadow-[0_0_18px_color-mix(in_oklch,var(--primary)_55%,transparent)] transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
                        style={{
                          width: `${GENERATION_PHASE_PROGRESS[generationPhase]}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {isSlowGeneration ? slowLoadingLabel : currentLoadingLabel}
                  </p>
                </div>
              )}

              {loadingStyle === 'steps' && isSlowGeneration && (
                <p className="mx-auto flex max-w-sm items-center justify-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="relative size-2 shrink-0" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full bg-primary motion-safe:animate-[gc-tryon-processing-ring_2.8s_ease-out_infinite] motion-reduce:opacity-50" />
                  </span>
                  <span>{slowLoadingLabel}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && job && (
          <TryOnResult
            job={job}
            productName={product.name}
            shopMode={!!shopProduct}
            controls={overrides?.result}
            onReset={handleReset}
          />
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                {t.errorTitle}
              </h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleReset}
              className="rounded-xl"
              id="tryon-retry-btn"
            >
              {t.tryAgain}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
