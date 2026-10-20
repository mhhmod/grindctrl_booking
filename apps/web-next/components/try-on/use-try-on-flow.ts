'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TryOnApiResponse,
  TryOnAttempt,
  TryOnJob,
  TryOnJobApiResponse,
  TryOnSession,
} from '@/lib/try-on/types';
import {
  bootstrapStorefrontProof,
  clearPendingStorefrontProof,
  getPendingStorefrontProof,
} from '@/lib/try-on/storefront-bootstrap';
import {
  createAttemptNonce,
  fetchWithOneRetry,
  keepTryOnResultInPage,
  pollTryOnJob,
} from '@/lib/try-on/client';
import { phoneStore } from '@/lib/try-on/phone-store';
import type { TryOnTranslator } from '@/lib/try-on/i18n';

/* The try-on's session and job, shared by today's embed (TryOnDemo) and
   the v16 sheet, so both make a look exactly the same way: one signed
   session per visit, one idempotent attempt per explicit tap, then the
   generation, polled until it settles, kept only in this page. */

export type TryOnFlowStep = 'upload' | 'consent' | 'generating' | 'result' | 'error';

export type GenerationPhase =
  | 'session-requested'
  | 'session-created'
  | 'generation-requested'
  | 'result-received';

const SLOW_GENERATION_MS = 12_000;

export type TryOnFlowProduct = { id: string; name: string };

export type TryOnFlowShopProduct = { handle: string; name: string; imageUrl: string };

export function useTryOnFlow({
  product,
  shopProduct,
  displayShop,
  variantId,
  t,
}: {
  product: TryOnFlowProduct;
  shopProduct?: TryOnFlowShopProduct;
  /** Display/settings context only. Billing authority comes from the signed capability. */
  displayShop?: string;
  variantId?: string;
  t: TryOnTranslator;
}) {
  const [step, setStep] = useState<TryOnFlowStep>('upload');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('session-requested');
  const [isSlowGeneration, setIsSlowGeneration] = useState(false);
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Set when the store cannot make looks right now (out of looks, plan
     lapsed): retrying cannot help, so the error offers no retry. */
  const [unavailable, setUnavailable] = useState(false);
  const [session, setSession] = useState<TryOnSession | null>(null);
  const [sessionState, setSessionState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionInitStarted = useRef(false);

  useEffect(() => {
    if (step !== 'generating' || generationPhase !== 'generation-requested') return;

    const slowTimer = window.setTimeout(() => {
      setIsSlowGeneration(true);
    }, SLOW_GENERATION_MS);

    return () => window.clearTimeout(slowTimer);
  }, [generationPhase, step]);

  const initializeSession = useCallback(async () => {
    setSessionState('loading');
    setSessionError(null);
    const storefrontProof = shopProduct
      ? getPendingStorefrontProof() ?? bootstrapStorefrontProof()
      : null;

    try {
      const sessionRes = await fetch('/api/try-on/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          storefrontProof
            ? {
                productId: product.id,
                context: 'storefront',
                storefrontContext: storefrontProof.token,
                storefrontNonce: storefrontProof.nonce,
                variantId,
              }
            : shopProduct
              ? {
                  // Temporary rollout bridge only. The server rejects this
                  // unless its explicitly named compatibility flag is on.
                  productId: product.id,
                  shop: displayShop,
                  variantId,
                }
              : { productId: product.id, context: 'public-demo' },
        ),
      });
      const sessionData: TryOnApiResponse<TryOnSession> = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.ok || !sessionData.data) {
        if (sessionRes.status === 400 || sessionRes.status === 401) {
          clearPendingStorefrontProof();
        }
        throw new Error(sessionData.error || t.genericError);
      }
      clearPendingStorefrontProof();
      setSession(sessionData.data);
      setSessionState('ready');
    } catch (err) {
      setSession(null);
      setSessionState('error');
      setSessionError(
        shopProduct ? t.storefrontProofError : err instanceof Error ? err.message : t.genericError,
      );
    }
  }, [displayShop, product.id, shopProduct, t.genericError, t.storefrontProofError, variantId]);

  /* Whatever this phone kept past its expiry goes on every load. */
  useEffect(() => {
    void phoneStore().purgeExpired();
  }, []);

  useEffect(() => {
    if (sessionInitStarted.current) return;
    sessionInitStarted.current = true;
    void initializeSession();
  }, [initializeSession]);

  const selectPhoto = useCallback((dataUrl: string) => {
    setPhotoDataUrl(dataUrl);
    setStep('consent');
    setError(null);
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoDataUrl(null);
    setStep('upload');
    setError(null);
  }, []);

  const generate = useCallback(async () => {
    setStep('generating');
    setGenerationPhase('session-requested');
    setIsSlowGeneration(false);
    setError(null);

    try {
      if (!session) {
        throw new Error(shopProduct ? t.storefrontProofError : t.genericError);
      }

      // 1. Mint one idempotent attempt for this explicit user action.
      const attemptNonce = createAttemptNonce();
      const attemptBody = JSON.stringify({
        sessionId: session.sessionId,
        productId: product.id,
        storefrontNonce: shopProduct ? session.nonce : undefined,
        variantId: shopProduct ? session.variantId : undefined,
        attemptNonce,
      });
      const attemptRes = await fetchWithOneRetry('/api/try-on/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: attemptBody,
      });
      const attemptData: TryOnApiResponse<TryOnAttempt> = await attemptRes.json();

      if (!attemptRes.ok || !attemptData.ok || !attemptData.data) {
        throw new Error(attemptData.error || t.genericError);
      }

      setGenerationPhase('session-created');

      // 2. Generate try-on
      const generationBody = JSON.stringify({
        sessionId: session.sessionId,
        attemptId: attemptData.data.attemptId,
        productId: product.id,
        storefrontNonce: shopProduct ? session.nonce : undefined,
        variantId: shopProduct ? session.variantId : undefined,
        photoSource: 'upload',
        photoReference: photoDataUrl ? 'uploaded-photo' : undefined,
        photoData: photoDataUrl ?? undefined,
        garmentUrl: shopProduct ? session.garmentUrl ?? undefined : undefined,
        productName: shopProduct?.name,
      });
      const generationRequest = fetchWithOneRetry('/api/try-on/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: generationBody,
      });
      setGenerationPhase('generation-requested');

      const genRes = await generationRequest;
      let genData: TryOnJobApiResponse = await genRes.json();

      if (
        genData.jobId &&
        ((genData.ok && (genData.status === 'queued' || genData.status === 'processing')) ||
          genData.code === 'TRYON_FINALIZATION_PENDING')
      ) {
        genData = await pollTryOnJob(genData.jobId, session.sessionId, t.genericError);
      }

      /* The server's TRYON_UNAVAILABLE sentence is English; a shopper in
         Arabic reads this store's language instead. */
      if (genData.code === 'TRYON_UNAVAILABLE' || genData.code === 'test_looks_cap') {
        setUnavailable(true);
        throw new Error(t.tryOnUnavailable);
      }
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

      /* The look now lives in this page; the server's copy is deleted. */
      const resultImageUrl = await keepTryOnResultInPage(
        genData.jobId,
        session.sessionId,
        genData.resultImageUrl,
      );

      setGenerationPhase('result-received');

      setJob({
        jobId: genData.jobId,
        sessionId: session.sessionId,
        productId: genData.productId,
        shop: session.shop,
        status: genData.status,
        resultImageUrl,
        message: genData.message,
        createdAt: new Date().toISOString(),
        meta: genData.meta,
      });
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
      setStep('error');
    }
  }, [photoDataUrl, product.id, session, shopProduct, t]);

  const retrySession = useCallback(() => {
    if (!shopProduct) {
      void initializeSession();
      return;
    }
    let targetOrigin = '*';
    try {
      if (document.referrer) targetOrigin = new URL(document.referrer).origin;
    } catch {
      // The parent validates event.source; no capability data is posted.
    }
    window.parent.postMessage({ type: 'grindctrl-tryon:refresh' }, targetOrigin);
  }, [initializeSession, shopProduct]);

  const reset = useCallback(() => {
    setPhotoDataUrl(null);
    setJob(null);
    setError(null);
    setUnavailable(false);
    setGenerationPhase('session-requested');
    setIsSlowGeneration(false);
    setStep('upload');
  }, []);

  return {
    step,
    photoDataUrl,
    generationPhase,
    isSlowGeneration,
    job,
    error,
    unavailable,
    session,
    sessionState,
    sessionError,
    selectPhoto,
    clearPhoto,
    generate,
    retrySession,
    reset,
  };
}
