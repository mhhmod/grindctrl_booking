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
import { TryOnResult } from './try-on-result';
import { getDefaultProduct } from '@/lib/try-on/products';
import type {
  TryOnApiResponse,
  TryOnJob,
  TryOnJobApiResponse,
  TryOnSession,
} from '@/lib/try-on/types';

type DemoStep = 'upload' | 'consent' | 'generating' | 'result' | 'error';

const LOADING_STEPS = [
  'Preparing your preview…',
  'Analyzing photo composition…',
  'Mapping product to your photo…',
  'Rendering try-on preview…',
  'Finalizing result…',
];

export function TryOnDemo() {
  const product = getDefaultProduct();

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
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
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
        throw new Error(sessionData.error || 'Failed to create session.');
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
        }),
      });
      const genData: TryOnJobApiResponse = await genRes.json();

      clearInterval(stepInterval);

      if (
        !genData.ok ||
        !genData.jobId ||
        !genData.status ||
        !genData.productId ||
        !genData.meta
      ) {
        throw new Error(genData.message || genData.error || 'Failed to generate preview.');
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
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setStep('error');
    }
  }, [photoDataUrl, product.id]);

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
      <div className="gc-fade-in-up rounded-2xl border p-6 sm:p-8 gc-landing-card" style={{ animationDelay: '0.1s' }}>
        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                Upload your photo
              </h3>
              <p className="text-sm text-muted-foreground">
                Upload a full or half-body photo to preview how the{' '}
                <span className="font-medium text-foreground">{product.name}</span>{' '}
                looks on you.
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
                Ready to generate your preview
              </h3>
              <p className="text-sm text-muted-foreground">
                Review the details below and tap generate when ready.
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
                <p className="text-xs text-muted-foreground">Your photo is ready</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFileClear}
                className="shrink-0 text-xs text-muted-foreground"
              >
                Change photo
              </Button>
            </div>

            {/* Privacy notice */}
            <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Privacy:</span>{' '}
                  Your photo is used only to create this try-on preview. It is not stored
                  permanently or shared publicly.
                </p>
                <p>
                  <span className="font-medium text-foreground">Note:</span>{' '}
                  The preview is visual guidance, not an exact sizing guarantee.
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
              Generate Try-On Preview
            </Button>
          </div>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="relative">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Loader2 className="size-7 animate-spin text-primary" />
              </div>
            </div>

            <div className="space-y-4 text-center">
              <h3 className="text-lg font-semibold text-foreground">
                Creating your preview
              </h3>
              <div className="mx-auto max-w-xs space-y-2">
                {LOADING_STEPS.map((label, idx) => (
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
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === 'result' && job && (
          <TryOnResult
            job={job}
            productName={product.name}
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
                Something went wrong
              </h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleReset}
              className="rounded-xl"
              id="tryon-retry-btn"
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
