'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  TryOnApiResponse,
  TryOnAttempt,
  TryOnJob,
  TryOnJobApiResponse,
  TryOnSession,
  TryOnStage,
} from '@/lib/try-on/types';
import { retryAfterDelayMs, TRYON_ASYNC_POLL_TIMEOUT_MS, TRYON_POLL_INITIAL_DELAY_MS } from '@/lib/try-on/poll-policy';
import { recordTryOnOpen, recordTryOnPhase } from '@/lib/try-on/performance';
import { attemptTurnstileToken, TurnstileChallengeError } from '@/lib/try-on/turnstile-client';
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
import { PHONE_KEEP_MS, phoneStore, type KeptLook } from '@/lib/try-on/phone-store';
import type { TryOnTranslator } from '@/lib/try-on/i18n';

/* The try-on's session and job, shared by today's embed (TryOnDemo) and
   the v16 sheet, so both make a look exactly the same way: one signed
   session per visit, one idempotent attempt per explicit tap, then the
   generation, polled until it settles, then kept on this device if allowed. */

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
  /** When the shopper tapped to make this look, for the sheet's countdown. */
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  /** The server's own stage, for a store whose looks are made after the answer (N38). */
  const [serverStage, setServerStage] = useState<TryOnStage | null>(null);
  /** How long the look took, from the tap to the look in this page. */
  const [generationSeconds, setGenerationSeconds] = useState<number | null>(null);
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Set when the store cannot make looks right now (out of looks, plan
     lapsed): retrying cannot help, so the error offers no retry. */
  const [unavailable, setUnavailable] = useState(false);
  /* Set when the website store's bot check (Turnstile) did not finish or was
     refused: the error offers a retry that runs a fresh check with the same
     photo and garment. */
  const [challengeFailed, setChallengeFailed] = useState(false);
  const [session, setSession] = useState<TryOnSession | null>(null);
  const [sessionState, setSessionState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionInitStarted = useRef(false);
  const restoredLook = useRef<KeptLook | null>(null);
  useEffect(() => { recordTryOnOpen(); }, []);

  const notifyLook = useCallback((state: 'ready' | 'stored' | 'cleared', expiresAt?: number, all?: boolean) => {
    if (!shopProduct || window.parent === window) return;
    let origin = '*';
    try { if (document.referrer) origin = new URL(document.referrer).origin; } catch { /* No personal data is posted. */ }
    window.parent.postMessage({ type: 'grindctrl-tryon:look', state, productId: product.id, expiresAt, all }, origin);
  }, [product.id, shopProduct]);

  // The iframe's IndexedDB is the existing photo store, not a second copy
  // in the merchant page. Never persist a session token or signed result URL.
  useEffect(() => {
    let live = true;
    // Query parameters describe the page; only the exchanged capability
    // authorizes reading a tenant's device-local look in an unpartitioned browser.
    if (!shopProduct || !displayShop || sessionState !== 'ready' ||
        session?.shop !== displayShop || session.productId !== product.id) return;
    const store = phoneStore();
    void store.latestLook(displayShop, product.id).then((kept) => {
      if (!live) return;
      if (!kept) { notifyLook('cleared'); return; }
      restoredLook.current = kept;
      // The global saved photo may have been replaced since this look was
      // made for a different piece. Do not compare it with the old result.
      setPhotoDataUrl(null);
      setJob({
        jobId: kept.jobId, sessionId: '', productId: kept.productId, shop: displayShop,
        status: 'completed', resultImageUrl: kept.imageDataUrl,
        createdAt: new Date(kept.savedAt).toISOString(),
        meta: { runtime: 'live', provider: '', costEstimate: null },
      });
      setStep('result');
      notifyLook('stored', kept.expiresAt);
    });
    return () => { live = false; };
  }, [displayShop, product.id, shopProduct, notifyLook, session, sessionState]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.data?.type !== 'grindctrl-tryon:visibility' || !event.data.open) return;
      const kept = restoredLook.current;
      if (kept && kept.expiresAt <= Date.now()) {
        restoredLook.current = null;
        setJob(null);
        setStep('upload');
        notifyLook('cleared');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [notifyLook]);

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
    if (restoredLook.current) return;
    setPhotoDataUrl(dataUrl);
    setStep((current) => current === 'result' || current === 'generating' ? current : 'consent');
    setError(null);
  }, []);

  const clearPhoto = useCallback(() => {
    setPhotoDataUrl(null);
    setStep('upload');
    setError(null);
  }, []);

  const generate = useCallback(async () => {
    const startedAt = Date.now();
    setStep('generating');
    setGenerationStartedAt(startedAt);
    setGenerationSeconds(null);
    setServerStage(null);
    setGenerationPhase('session-requested');
    setIsSlowGeneration(false);
    setError(null);
    setChallengeFailed(false);

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

      // A binding is present only for paid pasted looks. A fresh token is obtained
      // for this attempt; retries below reuse the exact same generation body.
      let turnstileToken: string | undefined;
      try { turnstileToken = await attemptTurnstileToken(attemptData.data.turnstile); }
      catch (challengeError) {
        if (challengeError instanceof TurnstileChallengeError) setChallengeFailed(true);
        throw new Error(t.genericError);
      }

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
        turnstileToken,
      });
      const uploadStartedAt = performance.now();
      const generationRequest = fetchWithOneRetry('/api/try-on/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: generationBody,
      });
      setGenerationPhase('generation-requested');

      const genRes = await generationRequest;
      let genData: TryOnJobApiResponse = await genRes.json();
      // Submission-to-acknowledgment; sync fallback contains provider time
      // and cannot provide an honest split through fetch alone.
      if (genRes.status === 202) recordTryOnPhase('upload', performance.now() - uploadStartedAt);
      const waitStartedAt = performance.now();

      if (genRes.status === 202 && genData.ok && genData.jobId) {
        /* The look is made after the answer (N38): follow its stages for
           as long as the server may take. */
        setServerStage(genData.stage ?? 'received');
        genData = await pollTryOnJob(genData.jobId, session.sessionId, t.genericError, undefined, {
          timeoutMs: TRYON_ASYNC_POLL_TIMEOUT_MS,
          initialDelayMs: Math.max(TRYON_POLL_INITIAL_DELAY_MS, retryAfterDelayMs(genRes.headers.get('Retry-After')) ?? 0),
          onProgress: (progress) => {
            if (progress.stage) setServerStage(progress.stage);
          },
        });
      } else if (
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
      // The server could not verify the check's token: a fresh check may pass.
      if (genData.code === 'turnstile_failed' || genData.code === 'turnstile_required') {
        setChallengeFailed(true);
        throw new Error(t.genericError);
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
      if (genRes.status === 202) recordTryOnPhase('wait_to_result', performance.now() - waitStartedAt);

      restoredLook.current = null;
      if (shopProduct && session.shop) {
        const savedAt = Date.now();
        const kept = {
          jobId: genData.jobId, tenantKey: session.shop, productId: product.id,
          productName: product.name, imageDataUrl: resultImageUrl,
        };
        if (await phoneStore().keepLook(kept, savedAt)) {
          restoredLook.current = { ...kept, savedAt, expiresAt: savedAt + PHONE_KEEP_MS };
        }
      }
      setGenerationPhase('result-received');
      setGenerationSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));

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
      notifyLook('ready', restoredLook.current?.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
      setStep('error');
    }
  }, [photoDataUrl, product.id, product.name, session, shopProduct, notifyLook, t]);

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
    restoredLook.current = null;
    setPhotoDataUrl(null);
    setJob(null);
    setError(null);
    setUnavailable(false);
    setChallengeFailed(false);
    setGenerationPhase('session-requested');
    setIsSlowGeneration(false);
    setGenerationStartedAt(null);
    setGenerationSeconds(null);
    setServerStage(null);
    setStep('upload');
  }, []);

  const forget = useCallback(async () => {
    await phoneStore().deleteAll();
    notifyLook('cleared', undefined, true);
    reset();
  }, [notifyLook, reset]);

  const discardBrokenLook = useCallback(async () => {
    if (job) await phoneStore().deleteLook(job.jobId);
    notifyLook('cleared');
    reset();
  }, [job, notifyLook, reset]);

  return {
    step,
    photoDataUrl,
    generationPhase,
    isSlowGeneration,
    generationStartedAt,
    generationSeconds,
    serverStage,
    job,
    error,
    unavailable,
    challengeFailed,
    session,
    sessionState,
    sessionError,
    selectPhoto,
    clearPhoto,
    generate,
    retrySession,
    reset,
    forget,
    discardBrokenLook,
  };
}
