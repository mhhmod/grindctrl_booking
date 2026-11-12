'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AUTH_SUPPORT_HREF, type AuthFormStateCopy } from '@/lib/auth/auth-i18n';

/* The states around Clerk's form, kept free of Clerk imports so they render
   (and are tested) without a Clerk provider.

   The form only exists once clerk.js has loaded in the browser. Until then
   the placeholder stands in its place in the shapes of Clerk's card: a
   heading, a social button, the divider, one labelled field, the continue
   button and the card's footer. The wrapper in AuthShell reserves the same
   height (AUTH_FORM_MIN_HEIGHT_CLASS), so the slow and failed states below
   take the same box and nothing under the form moves when one replaces
   another. */

/** Shared by AuthShell's form wrapper and every state in it. */
export const AUTH_FORM_MIN_HEIGHT_CLASS = 'min-h-[31rem]';

/** How long the placeholder waits for the form before saying so. */
export const AUTH_FORM_SLOW_MS = 12_000;

export function AuthFormSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" data-auth-form-state="loading" className={`flex ${AUTH_FORM_MIN_HEIGHT_CLASS} w-full flex-col`}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
          <div className="space-y-2">
            <Skeleton className="h-6 w-1/2 rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-3 w-6 shrink-0 rounded-sm" />
            <Skeleton className="h-px flex-1" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-border px-6 py-5">
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-3 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Same box as the form, with a way forward: reload, or write to support. */
export function AuthFormProblem({
  copy,
  kind,
  onRetry,
}: {
  copy: AuthFormStateCopy;
  kind: 'slow' | 'failed';
  onRetry?: () => void;
}) {
  const title = kind === 'slow' ? copy.formSlowTitle : copy.formFailedTitle;
  const body = kind === 'slow' ? copy.formSlowBody : copy.formFailedBody;
  return (
    <div
      role="alert"
      data-auth-form-state={kind}
      className={`flex ${AUTH_FORM_MIN_HEIGHT_CLASS} w-full flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-8 text-center`}
    >
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button type="button" className="h-11 w-full" onClick={onRetry ?? (() => window.location.reload())}>
          {copy.retry}
        </Button>
        <Button asChild variant="ghost" className="h-11 w-full">
          <a href={AUTH_SUPPORT_HREF}>{copy.contactSupport}</a>
        </Button>
      </div>
    </div>
  );
}

/** The placeholder, until a bounded wait says the form is late. */
export function AuthFormPlaceholder({
  copy,
  slowAfterMs = AUTH_FORM_SLOW_MS,
}: {
  copy: AuthFormStateCopy;
  slowAfterMs?: number;
}) {
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(timer);
  }, [slowAfterMs]);
  return slow ? <AuthFormProblem copy={copy} kind="slow" /> : <AuthFormSkeleton label={copy.formLoading} />;
}

/** No auth configured in production: say so plainly, never name a setting. */
export function AuthUnavailable({ title, body, contactLabel }: { title: string; body: string; contactLabel: string }) {
  return (
    <div
      role="alert"
      data-auth-form-state="unavailable"
      className={`flex ${AUTH_FORM_MIN_HEIGHT_CLASS} w-full flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-8 text-center`}
    >
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button asChild variant="ghost" className="h-11">
        <a href={AUTH_SUPPORT_HREF}>{contactLabel}</a>
      </Button>
    </div>
  );
}
