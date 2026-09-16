'use client';

import React, { useSyncExternalStore } from 'react';
import posthog from 'posthog-js';
import { Button } from '@/components/ui/button';
import { useLandingLocale } from '@/components/landing/landing-locale';
import {
  readAnalyticsConsent,
  setAnalyticsConsent,
} from '@/lib/analytics/consent';
import type { AnalyticsConsentState } from '@/lib/analytics/events';

const consentListeners = new Set<() => void>();

function subscribeToConsent(listener: () => void) {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

function getConsentSnapshot(): AnalyticsConsentState {
  return readAnalyticsConsent(posthog);
}

function getServerConsentSnapshot(): AnalyticsConsentState {
  return 'unknown';
}

function notifyConsentChanged() {
  consentListeners.forEach((listener) => listener());
}

export function AnalyticsConsentControl() {
  const { t } = useLandingLocale();
  const consent = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerConsentSnapshot,
  );

  const choose = (next: Exclude<AnalyticsConsentState, 'unknown'>) => {
    try {
      setAnalyticsConsent(posthog, next);
      notifyConsentChanged();
    } catch {
      // Leave the last confirmed choice visible if the SDK is unavailable.
    }
  };

  const status = consent === 'granted'
    ? t.analyticsStatusGranted
    : consent === 'denied'
      ? t.analyticsStatusDenied
      : t.analyticsStatusUnknown;

  return (
    <section
      aria-labelledby="analytics-preferences-title"
      aria-describedby="analytics-preferences-description analytics-preferences-status"
      className="gc-landing-card grid min-w-0 gap-4 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
    >
      <div className="min-w-0">
        <h2 id="analytics-preferences-title" className="text-sm font-semibold text-foreground">
          {t.analyticsTitle}
        </h2>
        <p id="analytics-preferences-description" className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          {t.analyticsDescription}
        </p>
        <p id="analytics-preferences-status" role="status" aria-live="polite" className="mt-2 text-xs font-medium text-foreground">
          {t.analyticsStatusLabel}: {status}
        </p>
      </div>

      <fieldset className="grid grid-cols-2 gap-2 sm:min-w-64">
        <legend className="sr-only">{t.analyticsChoiceLabel}</legend>
        <Button
          type="button"
          variant={consent === 'denied' ? 'secondary' : 'outline'}
          aria-pressed={consent === 'denied'}
          onClick={() => choose('denied')}
          className="h-11 px-3 text-xs sm:text-sm"
        >
          {t.analyticsDeny}
        </Button>
        <Button
          type="button"
          variant={consent === 'granted' ? 'default' : 'outline'}
          aria-pressed={consent === 'granted'}
          onClick={() => choose('granted')}
          className="h-11 px-3 text-xs sm:text-sm"
        >
          {t.analyticsAllow}
        </Button>
      </fieldset>
    </section>
  );
}
