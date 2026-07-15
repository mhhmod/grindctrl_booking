'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  CheckCircle,
  Loader2,
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
  shopProduct,
  overrides,
}: {
  productId?: string;
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
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setLoadingStepIdx(0);
    setError(null);

    // Animate through loading steps
    const stepInterval = setInterval(() => {
      setLoadingStepIdx((prev) => {
        if (prev < loadingSteps.length - 1) return prev + 1;
        return prev;
      });
    }, 600);

    try {
      // 1. Create session
      const sessionRes = await fetch('/api/try-on/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      });
      const sessionData: TryOnApiResponse<TryOnSession> = await sessionRes.json();

      if (!sessionData.ok || !sessionData.data) {
        throw new Error(sessionData.error || t.genericError);
      }

      // 2. Generate try-on
      const genRes = await fetch('/api/try-on/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionData.data.sessionId,
          productId: product.id,
          photoSource: 'upload',
          photoReference: photoDataUrl ? 'uploaded-photo' : undefined,
          photoData: photoDataUrl ?? undefined,
          garmentUrl: shopProduct?.imageUrl,
          productName: shopProduct?.name,
        }),
      });
      const genData: TryOnJobApiResponse = await genRes.json();

      clearInterval(stepInterval);

      if (
        !genData.ok ||
        !genData.jobId ||
        !genData.status ||
        !genData.productId ||
        !genData.meta ||
        genData.status === 'failed' ||
        (genData.status === 'completed' && !genData.resultImageUrl)
      ) {
        throw new Error(genData.message || genData.error || t.genericError);
      }

      setJob({
        jobId: genData.jobId,
        sessionId: sessionData.data.sessionId,
        productId: genData.productId,
        status: genData.status,
        resultImageUrl: genData.resultImageUrl,
        message: genData.message,
        createdAt: new Date().toISOString(),
        meta: genData.meta,
      });
      setStep('result');
    } catch (err) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : t.genericError);
      setStep('error');
    }
  }, [photoDataUrl, product.id, shopProduct, loadingSteps.length, t]);

  const handleReset = useCallback(() => {
    setPhotoDataUrl(null);
    setJob(null);
    setError(null);
    setLoadingStepIdx(0);
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

        <div className="flex-1 space-y-3 text-center sm:text-start">
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
      <div className="gc-fade-in-up min-h-[420px] rounded-2xl border p-6 sm:p-8 gc-landing-card" style={{ animationDelay: '0.1s' }}>
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
                  alt="Your uploaded photo"
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
          <div className="flex flex-col items-center gap-6 py-8">
            {loadingStyle === 'pulse' && product.imageUrl ? (
              <div className="relative">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  width={160}
                  height={213}
                  className="aspect-[3/4] w-32 animate-pulse rounded-xl border object-cover"
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-background/60 to-transparent" />
              </div>
            ) : loadingStyle !== 'bar' ? (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Loader2 className="size-7 animate-spin text-primary" />
              </div>
            ) : null}

            <div className="w-full space-y-4 text-center">
              <h3 className="text-lg font-semibold text-foreground">
                {t.generatingTitle}
              </h3>

              {loadingStyle === 'steps' ? (
                <div className="mx-auto max-w-xs space-y-2">
                  {loadingSteps.map((label, idx) => (
                    <div
                      key={label}
                      className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                        idx < loadingStepIdx
                          ? 'text-primary'
                          : idx === loadingStepIdx
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground/40'
                      }`}
                    >
                      {idx < loadingStepIdx ? (
                        <CheckCircle className="size-4 shrink-0" />
                      ) : idx === loadingStepIdx ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" />
                      ) : (
                        <div className="size-4 shrink-0" />
                      )}
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mx-auto max-w-xs space-y-3">
                  {loadingStyle === 'bar' && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.round(((loadingStepIdx + 1) / loadingSteps.length) * 90)}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {loadingSteps[Math.min(loadingStepIdx, loadingSteps.length - 1)]}
                  </p>
                </div>
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
