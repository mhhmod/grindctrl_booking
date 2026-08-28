'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerLocale } from '@/lib/messenger/types';
import { getPanelCopy } from './i18n';

/* The shopper-facing messenger surface. Rendered inside an iframe on
   grindctrl.cloud/embed/messenger so merchant theme CSS can never reach it.
   Everything visual derives from the published config payload + theme
   tokens; nothing here reads localStorage beyond the session keys below. */

const ANON_KEY = (key: string) => `gc_msgr_${key}_anon`;
const CONV_KEY = (key: string) => `gc_msgr_${key}_conv`;
const TOKEN_KEY = (key: string) => `gc_msgr_${key}_shopper_token`;

interface WireMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  author?: string;
  escalated?: boolean;
  pending?: boolean;
  failed?: boolean;
}

function detectInitialLocale(explicit: string | null): MessengerLocale {
  if (explicit === 'ar' || explicit === 'en') return explicit;
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function radiusFor(style: 'soft' | 'rounded' | 'sharp'): string {
  if (style === 'sharp') return '4px';
  if (style === 'rounded') return '20px';
  return '12px';
}

export function MessengerPanel({
  config,
  variant = 'live',
  locale: localeOverride,
}: {
  config: PublicMessengerPayload;
  variant?: 'live' | 'preview';
  /** Dashboard preview only. The live panel has no parent to ask, so it
   *  reads the iframe URL; rendered inline that URL is the dashboard's and
   *  carries no locale, which left the preview stuck in English while its
   *  frame flipped to RTL. */
  locale?: MessengerLocale;
}) {
  const [locale, setLocale] = useState<MessengerLocale>(localeOverride ?? 'en');
  // Locale must resolve after hydration (the iframe URL is the source of
  // truth for the live widget; an SSR initializer would mismatch for Arabic
  // shoppers). An explicit override wins and stays in sync.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- post-hydration locale resolution, see above
    setLocale(
      localeOverride ?? detectInitialLocale(new URLSearchParams(window.location.search).get('locale')),
    );
  }, [localeOverride]);
  const t = getPanelCopy(locale);
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  const dark =
    config.appearance.themeMode === 'dark' ||
    (config.appearance.themeMode === 'auto' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches === true);

  const accent = config.appearance.accentColor;

  /* Session state */
  const [anonId, setAnonId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [booting, setBooting] = useState(variant === 'preview' ? false : true);
  const [bootError, setBootError] = useState(false);
  const [typing, setTyping] = useState(false);

  /* Composer */
  const [draft, setDraft] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const origin = useMemo(
    () =>
      typeof window !== 'undefined'
        ? window.location.ancestorOrigins?.[0] || document.referrer || null
        : null,
    [],
  );
  // ancestorOrigins is Chromium-only; referrer covers Safari/Firefox well
  // enough for the loader (which also passes ?origin= explicitly).
  const effectiveOrigin = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const fromQuery = new URLSearchParams(window.location.search).get('origin');
    return fromQuery ?? (origin || window.location.origin);
  }, [origin]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      // Element.scrollTo is missing in a few older mobile webviews, and an
      // exception raised inside rAF has no caller to catch it.
      if (typeof list.scrollTo === 'function') list.scrollTo({ top: list.scrollHeight });
      else list.scrollTop = list.scrollHeight;
    });
  }, []);

  /* Bootstrap / restore. Preview variant performs no network and owns no
     session state — it is a pure visual render of the given config. */
  useEffect(() => {
    if (variant !== 'live') return;
    let cancelled = false;
    (async () => {
      try {
        const storedAnon = localStorage.getItem(ANON_KEY(config.key));
        const storedConv = localStorage.getItem(CONV_KEY(config.key));
        const shopperToken = sessionStorage.getItem(TOKEN_KEY(config.key));
        const res = await fetch('/api/messenger/bootstrap', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            key: config.key,
            origin: effectiveOrigin,
            anonymousId: storedAnon ?? undefined,
            conversationId: storedConv ?? undefined,
            shopperToken: shopperToken ?? undefined,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          anonymousId: string;
          conversationId: string;
          status: string;
          messages: WireMessage[];
        };
        if (cancelled) return;
        localStorage.setItem(ANON_KEY(config.key), data.anonymousId);
        localStorage.setItem(CONV_KEY(config.key), data.conversationId);
        setAnonId(data.anonymousId);
        setConversationId(data.conversationId);
        setStatus(data.status);
        setMessages(data.messages);
      } catch {
        if (!cancelled) setBootError(true);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.key, effectiveOrigin, variant]);

  /* Reconnect sync on focus/visible — cheap recovery after sleep/offline. */
  useEffect(() => {
    function sync() {
      if (document.visibilityState !== 'visible' || !conversationId || !anonId) return;
      const last = messages[messages.length - 1]?.createdAt;
      fetch(
        `/api/messenger/sync?key=${encodeURIComponent(config.key)}&origin=${encodeURIComponent(
          effectiveOrigin ?? '',
        )}&anonId=${anonId}&conversationId=${conversationId}${last ? `&after=${encodeURIComponent(last)}` : ''}`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.messages?.length) {
            if (typeof data?.status === 'string') setStatus(data.status);
            return;
          }
          setStatus(data.status ?? null);
          setMessages((prev) => {
            const seen = new Set(prev.filter((m) => !m.pending && !m.failed).map((m) => m.id));
            const fresh = data.messages as WireMessage[];
            return [...prev.filter((m) => !m.pending && !m.failed), ...fresh.filter((m) => !seen.has(m.id))];
          });
        })
        .catch(() => {});
    }
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [config.key, conversationId, anonId, messages, effectiveOrigin]);

  useEffect(scrollToEnd, [messages.length, typing, scrollToEnd]);

  /* Focus the composer once booted so keyboard-only shoppers can type at once. */
  useEffect(() => {
    if (!booting) inputRef.current?.focus();
  }, [booting]);

  async function send(overrideText?: string) {
    const text = (overrideText ?? draft).trim();
    if (variant === 'preview') return;
    if (!text || !anonId || !conversationId) return;
    setDraft('');
    resizeInput();

    const clientKey = crypto.randomUUID();
    const optimistic: WireMessage = {
      id: `pending-${clientKey}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTyping(true);

    try {
      const res = await fetch('/api/messenger/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: config.key,
          origin: effectiveOrigin,
          anonymousId: anonId,
          conversationId,
          text,
          clientKey,
          shopperToken: sessionStorage.getItem(TOKEN_KEY(config.key)) ?? undefined,
          locale,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { userMessage?: WireMessage; reply?: WireMessage | null; status?: string; error?: string }
        | null;
      if (!res.ok || !data?.userMessage) throw new Error(data?.error ?? 'send_failed');

      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...data.userMessage!, pending: false } : m)),
      );
      if (data.reply) setMessages((prev) => [...prev, data.reply!]);
      if (data.status) setStatus(data.status);
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m)));
    } finally {
      setTyping(false);
      inputRef.current?.focus();
    }
  }

  function retryFailed(message: WireMessage) {
    // Remove the failed bubble first so the fresh optimistic copy is the
    // only representation of this turn, then resend its exact text.
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    setDraft('');
    void send(message.content);
  }

  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function giveFeedback(rating: 'up' | 'down') {
    if (!anonId || !conversationId || feedbackGiven) return;
    setFeedbackGiven(true);
    await fetch('/api/messenger/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: config.key,
        origin: effectiveOrigin,
        anonymousId: anonId,
        conversationId,
        rating,
      }),
    }).catch(() => {});
  }

  const placeholder = pickLocalizedSafe(config.behaviour.inputPlaceholder, locale, t.messagePlaceholderFallback);
  const welcomeTitle = pickLocalizedSafe(config.behaviour.welcomeTitle, locale, '');
  const welcomeSubtitle = pickLocalizedSafe(config.behaviour.welcomeSubtitle, locale, '');

  const showHandoffBanner =
    status === 'handoff_requested' || status === 'handoff_active' || status === 'closed';
  const lastIsOurs = messages.length > 0 && ['assistant', 'system'].includes(messages[messages.length - 1].role);

  if (bootError) {
    return (
      <div dir={dir} className={`flex h-dvh flex-col items-center justify-center gap-2 p-6 text-center ${dark ? 'dark' : ''} bg-background text-foreground`}>
        <p className="text-sm font-semibold">{t.unavailableTitle}</p>
        <p className="text-xs text-muted-foreground">{t.unavailableBody}</p>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      lang={locale}
      className={`${dark ? 'dark' : ''} ${variant === 'preview' ? 'h-full min-h-[460px]' : 'h-dvh'} flex flex-col bg-background font-sans text-foreground`}
      style={{ ['--accent' as string]: accent }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {config.appearance.assistantAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.appearance.assistantAvatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initialOf(config.storeName)
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{config.storeName}</p>
          <p className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
            <span
              aria-hidden="true"
              className={`inline-block size-1.5 rounded-full ${config.available ? 'bg-emerald-500' : 'bg-zinc-400'}`}
            />
            {config.available ? t.aiNotice : t.offlineNote}
          </p>
        </div>
      </header>

      {/* Thread */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {messages.length === 0 && !booting && (
          <div className="mx-auto max-w-[85%] pt-6 text-center">
            <p className="text-base font-semibold">{welcomeTitle}</p>
            {welcomeSubtitle && <p className="mt-1 text-xs text-muted-foreground">{welcomeSubtitle}</p>}
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'system') {
            return (
              /* Transcript history, not a live region: the handoff banner
                 below is the one thing that should announce itself, or a
                 restored conversation re-reads every past event on open. */
              <p key={m.id} className="text-center text-[11px] text-muted-foreground">
                {m.content}
              </p>
            );
          }
          const mine = m.role === 'user';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={
                  mine
                    ? 'max-w-[85%] rounded-2xl rounded-ee-md px-3.5 py-2 text-sm text-white'
                    : 'max-w-[85%] rounded-2xl rounded-es-md border border-border bg-card px-3.5 py-2 text-sm'
                }
                style={mine ? { backgroundColor: accent } : undefined}
              >
                {m.content}
                {m.pending && <span className="ms-2 inline-block animate-pulse">…</span>}
                {m.failed && (
                  <span className="mt-1 flex items-center gap-2 text-[11px] opacity-90">
                    {t.sendFailed}
                    <button
                      type="button"
                      onClick={() => retryFailed(m)}
                      className="rounded-full border border-current px-2 py-0.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2"
                    >
                      {t.retry}
                    </button>
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="flex justify-start" aria-label={t.typing} role="status">
            <div className="flex items-center gap-1 rounded-2xl rounded-es-md border border-border bg-card px-3 py-2.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 motion-reduce:animate-none"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {showHandoffBanner && (
          <p className="text-center text-[11px] text-muted-foreground" role="status">
            {status === 'handoff_active'
              ? t.teamReplied
              : status === 'closed'
                ? t.resolved
                : t.connectingTeam}
          </p>
        )}

        {status === 'closed' && lastIsOurs && (
          <div className="mx-auto w-fit rounded-full border border-border px-3 py-1.5 text-[11px] text-muted-foreground">
            {feedbackGiven ? (
              t.feedbackThanks
            ) : (
              <span className="flex items-center gap-2">
                {t.rateQuestion}
                <button
                  type="button"
                  onClick={() => giveFeedback('up')}
                  aria-label="Helpful"
                  className="rounded-full px-1.5 py-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
                >
                  👍
                </button>
                <button
                  type="button"
                  onClick={() => giveFeedback('down')}
                  aria-label="Not helpful"
                  className="rounded-full px-1.5 py-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
                >
                  👎
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <footer className="border-t border-border bg-card p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="gc-msgr-input" className="sr-only">
            {placeholder}
          </label>
          <textarea
            id="gc-msgr-input"
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={booting}
            onChange={(e) => {
              setDraft(e.target.value.slice(0, 2000));
              resizeInput();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={placeholder}
            className="max-h-[120px] min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          />
          <button
            type="submit"
            aria-label={t.sendAria}
            disabled={!draft.trim() || booting}
            className="flex size-[42px] shrink-0 items-center justify-center rounded-xl text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
            style={{ backgroundColor: accent }}
          >
            <SendIcon />
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">{t.poweredBy}</p>
      </footer>
    </div>
  );
}

function pickLocalizedSafe(value: { en: string; ar: string }, locale: MessengerLocale, fallback: string): string {
  const chosen = locale === 'ar' ? value.ar || value.en : value.en || value.ar;
  return chosen || fallback;
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 rtl:-scale-x-100" fill="currentColor" aria-hidden="true">
      <path d="M3.4 20.4 21.85 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" />
    </svg>
  );
}
