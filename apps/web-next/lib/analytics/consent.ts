import type { AnalyticsConsentState } from '@/lib/analytics/events';

export type AnalyticsConsentClient = {
  get_explicit_consent_status?(): 'granted' | 'denied' | 'pending';
  has_opted_in_capturing(): boolean;
  has_opted_out_capturing(): boolean;
  opt_in_capturing(): void;
  opt_out_capturing(): void;
};

export type AnalyticsConsentProvider = () => AnalyticsConsentState;

/* PostHog may be initialized so a previously stored decision can be read, but
   initialization itself must not collect or store anything. Opting out of
   capture alone still wrote an identity cookie plus local/session storage and
   pulled remote config and extension scripts on every first visit, so storage
   stays off until opt_in_capturing(), and remote config and external scripts
   stay off entirely (the app uses no flags, surveys, or replay). The consent
   decision itself is the only thing PostHog persists before a choice.
   Intentional events and the public preference control use the same
   SDK-backed consent state. */
export const POSTHOG_FAIL_CLOSED_CONFIG = Object.freeze({
  opt_out_capturing_by_default: true,
  opt_out_persistence_by_default: true,
  advanced_disable_flags: true,
  disable_external_dependency_loading: true,
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_exceptions: false,
  disable_session_recording: true,
});

export function readAnalyticsConsent(client: Pick<AnalyticsConsentClient, 'get_explicit_consent_status' | 'has_opted_in_capturing' | 'has_opted_out_capturing'>): AnalyticsConsentState {
  try {
    /* PostHog's explicit status deliberately ignores the fail-closed default,
       which lets the UI distinguish "not chosen" from an actual denial. */
    if (client.get_explicit_consent_status) {
      const explicit = client.get_explicit_consent_status();
      if (explicit === 'granted' || explicit === 'denied') return explicit;
      return 'unknown';
    }
    if (client.has_opted_in_capturing() === true) return 'granted';
    if (client.has_opted_out_capturing() === true) return 'denied';
  } catch {
    // A missing or partially initialized SDK must never imply consent.
  }
  return 'unknown';
}

export function enforceAnalyticsConsent(client: AnalyticsConsentClient): AnalyticsConsentState {
  const consent = readAnalyticsConsent(client);
  if (consent === 'denied') {
    try {
      client.opt_out_capturing();
    } catch {
      // Initialization remains fail closed through POSTHOG_FAIL_CLOSED_CONFIG.
    }
  }
  return consent;
}

/* This is the sole state transition API for consent surfaces. PostHog persists
   both transitions using its configured consent persistence. */
export function setAnalyticsConsent(
  client: Pick<AnalyticsConsentClient, 'opt_in_capturing' | 'opt_out_capturing'>,
  consent: Exclude<AnalyticsConsentState, 'unknown'>,
): void {
  if (consent === 'granted') client.opt_in_capturing();
  else client.opt_out_capturing();
}
