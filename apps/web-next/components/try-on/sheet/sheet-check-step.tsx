'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronLeft, CircleAlert, ShieldCheck, Trash2, User } from 'lucide-react';
import { checkPhoto, type PhotoCheck } from '@/lib/try-on/photo-check';
import type { SheetCopy } from '@/lib/try-on/sheet-copy';

/* TryOn-Check (02-try-on.md): the photo is checked on the phone before
   anything is sent. A failing check names the fix and says nothing was
   sent; "Use this photo anyway" always goes on. The first time only, the
   consent block follows, stored on the phone apart from the photo. */
export function SheetCheckStep({
  copy,
  photoDataUrl,
  firstTime,
  keepOnPhone,
  busy,
  onKeepOnPhone,
  onDifferentPhoto,
  onTryOn,
  onShowPrivacy,
}: {
  copy: SheetCopy;
  photoDataUrl: string;
  /** No consent stored on this phone yet. */
  firstTime: boolean;
  keepOnPhone: boolean;
  /** The session is not ready yet, so trying on must wait. */
  busy: boolean;
  onKeepOnPhone: (on: boolean) => void;
  onDifferentPhoto: () => void;
  onTryOn: () => void;
  onShowPrivacy: () => void;
}) {
  // Both are kept with the photo they belong to, so a new photo starts unchecked.
  const [checked, setChecked] = useState<{ src: string; result: PhotoCheck | null } | null>(null);
  const [overriddenFor, setOverriddenFor] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void checkPhoto(photoDataUrl).then((result) => {
      if (live) setChecked({ src: photoDataUrl, result });
    });
    return () => {
      live = false;
    };
  }, [photoDataUrl]);

  const check = checked?.src === photoDataUrl ? checked.result : 'checking';
  const overridden = overriddenFor === photoDataUrl;
  const result = check === 'checking' ? null : check;

  if (result && result.issue && !overridden) {
    const fix = result.issue === 'dark' ? copy.fixDark : result.issue === 'bright' ? copy.fixBright : copy.fixBlurry;
    return (
      <div className="flex min-h-full flex-col gap-5">
        <StepHeader copy={copy} onBack={onDifferentPhoto} />
        <div className="flex gap-4">
          <Photo src={photoDataUrl} alt={copy.yourPhotoAlt} />
          <div className="min-w-0 flex-1 space-y-3" role="status">
            <p className="flex items-start gap-2 text-base font-semibold text-foreground">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
              {fix}
            </p>
            <CheckLine ok={result.light} label={copy.checkLight} />
            <CheckLine ok={result.sharp} label={copy.checkSharp} />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{copy.whyItMatters}</p>
        <p className="text-sm font-medium text-foreground">{copy.nothingSent}</p>
        <div className="mt-auto space-y-2">
          <button type="button" onClick={onDifferentPhoto} className={PRIMARY}>
            {copy.takeAgain}
          </button>
          <button type="button" onClick={() => setOverriddenFor(photoDataUrl)} className={SECONDARY}>
            {copy.useAnyway}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-5">
      <StepHeader copy={copy} onBack={onDifferentPhoto} />
      <div className="flex gap-4">
        <Photo src={photoDataUrl} alt={copy.yourPhotoAlt} />
        <div className="min-w-0 flex-1 space-y-3">
          {check === 'checking' ? (
            <p role="status" className="text-sm text-muted-foreground">
              {copy.checking}
            </p>
          ) : result && !overridden ? (
            <div role="status" className="space-y-3">
              <p className="text-sm font-semibold text-[var(--gc-success,#2f6b3a)]">{copy.looksGreat}</p>
              <CheckLine ok label={copy.checkBrightSharp} />
            </div>
          ) : null}
          <button type="button" onClick={onDifferentPhoto} className="text-sm font-medium text-foreground underline underline-offset-2">
            {copy.useDifferent}
          </button>
        </div>
      </div>

      {firstTime && (
        <section className="space-y-3 rounded-2xl bg-muted/50 p-4" aria-labelledby="gc-consent-title">
          <h3 id="gc-consent-title" className="text-base font-semibold text-foreground">
            {copy.consentTitle}
          </h3>
          <p className="flex gap-3 text-sm leading-relaxed text-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {copy.consentService}
          </p>
          <p className="flex gap-3 text-sm leading-relaxed text-foreground">
            <Trash2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {copy.consentRetention}
          </p>
        </section>
      )}

      <label className="flex items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-base font-semibold text-foreground">{copy.keepOnPhone}</span>
          <span className="block text-sm text-muted-foreground">{copy.keepOnPhoneHint}</span>
        </span>
        <span className="relative inline-flex h-7 w-12 shrink-0">
          <input
            type="checkbox"
            role="switch"
            checked={keepOnPhone}
            onChange={(event) => onKeepOnPhone(event.target.checked)}
            className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-muted-foreground/60 transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
          />
          <span
            aria-hidden="true"
            className="absolute start-0.5 top-0.5 size-6 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5 motion-reduce:transition-none rtl:peer-checked:-translate-x-5"
          />
        </span>
      </label>

      <div className="mt-auto space-y-2 border-t pt-4">
        <button type="button" onClick={onTryOn} disabled={busy || check === 'checking'} className={PRIMARY}>
          <User className="size-5" aria-hidden="true" />
          {firstTime ? copy.agreeAndTry : copy.tryItOn}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          {copy.agreeNote}{' '}
          <button type="button" onClick={onShowPrivacy} className="underline underline-offset-2">
            {copy.privacyNoticeLink}
          </button>
          .
        </p>
      </div>
    </div>
  );
}

const PRIMARY =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
const SECONDARY =
  'flex h-12 w-full items-center justify-center rounded-xl border px-4 text-base font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function StepHeader({ copy, onBack }: { copy: SheetCopy; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label={copy.back}
        className="grid size-11 place-items-center rounded-full hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
      </button>
      <h2 className="text-lg font-semibold text-foreground">{copy.yourPhoto}</h2>
    </div>
  );
}

function Photo({ src, alt }: { src: string; alt: string }) {
  return (
    // A data URL the shopper just chose; next/image cannot optimise it.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="aspect-[3/4] w-36 shrink-0 rounded-2xl border object-cover sm:w-44" />
  );
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-foreground">
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full ${ok ? 'bg-[var(--gc-success-soft,#e3f1e5)] text-[var(--gc-success,#2f6b3a)]' : 'bg-destructive/10 text-destructive'}`}
        aria-hidden="true"
      >
        {ok ? <Check className="size-3.5" /> : <CircleAlert className="size-3.5" />}
      </span>
      {label}
    </p>
  );
}
