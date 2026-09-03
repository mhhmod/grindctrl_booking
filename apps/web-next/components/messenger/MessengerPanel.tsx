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

/* Matches what /api/messenger/sync documents and is rate-limited for. */
const SYNC_INTERVAL_MS = 15_000;

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

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/* Same shape rule as lib/messenger/contact.ts. Duplicated rather than
   imported because that module is bundled for the server; this copy only
   decides whether to bother with a round trip, and the server's answer is
   the one that counts. */
const CONTACT_EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

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
  originToken,
}: {
  config: PublicMessengerPayload;
  variant?: 'live' | 'preview';
  /** Signed proof of the storefront this panel was framed by, minted by the
   *  embed page after it verified the Referer. The panel cannot establish
   *  its own storefront — its fetches are same-origin with this app — so it
   *  carries this instead of asserting an origin the server has no reason to
   *  believe. Absent in the dashboard preview, which makes no network calls. */
  originToken?: string | null;
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

  /* Contact capture — offered by the server at most once per conversation. */
  const [askContact, setAskContact] = useState(false);
  const [contactDraft, setContactDraft] = useState('');
  const [contactState, setContactState] = useState<'idle' | 'sending' | 'done' | 'invalid'>('idle');

  /* Attachments. The shopper sees their own photo from a local object URL:
     they already have the bytes, so there is no reason to hand a storefront
     a signed URL into the merchant's private bucket. */
  const [uploading, setUploading] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  /* Revoked only on unmount. Keying the cleanup on the state would revoke
     the previous URLs every time a new photo is added — including the ones
     still on screen. */
  const objectUrlsRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    },
    [],
  );

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
            originToken,
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
  }, [config.key, effectiveOrigin, originToken, variant]);

  /* Reconnect sync on focus/visible — cheap recovery after sleep/offline. */
  useEffect(() => {
    function sync() {
      if (document.visibilityState !== 'visible' || !conversationId || !anonId) return;
      const last = messages[messages.length - 1]?.createdAt;
      fetch(
        `/api/messenger/sync?key=${encodeURIComponent(config.key)}&origin=${encodeURIComponent(
          effectiveOrigin ?? '',
        )}&originToken=${encodeURIComponent(originToken ?? '')}&anonId=${anonId}&conversationId=${conversationId}${
          last ? `&after=${encodeURIComponent(last)}` : ''
        }`,
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
    /* The events alone were never enough. This panel is an iframe, and a
       shopper who has asked a question and is waiting for an answer switches
       nothing and clicks nothing: visibilitychange does not fire because the
       tab stays visible, and focus does not fire because focus never leaves.
       So a reply typed by the merchant sat in the database until the shopper
       happened to tab away and back. Poll while visible — the interval this
       endpoint was documented and rate-limited for, and which was simply
       never written. */
    const timer = window.setInterval(sync, SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [config.key, conversationId, anonId, messages, effectiveOrigin, originToken]);

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
          originToken,
          anonymousId: anonId,
          conversationId,
          text,
          clientKey,
          shopperToken: sessionStorage.getItem(TOKEN_KEY(config.key)) ?? undefined,
          locale,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            conversationId?: string;
            userMessage?: WireMessage;
            reply?: WireMessage | null;
            status?: string;
            error?: string;
            askContact?: boolean;
          }
        | null;
      if (!res.ok || !data?.userMessage) throw new Error(data?.error ?? 'send_failed');

      /* The server revives a conversation the merchant resolved by starting a
         fresh one, so this message may not belong to the thread we sent it
         from. Adopt the id it reports — otherwise every later send, and every
         sync, keeps addressing the dead thread. */
      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(CONV_KEY(config.key), data.conversationId);
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...data.userMessage!, pending: false } : m)),
      );
      if (data.reply) setMessages((prev) => [...prev, data.reply!]);
      if (data.status) setStatus(data.status);
      if (data.askContact) setAskContact(true);
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

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    const email = contactDraft.trim();
    if (!CONTACT_EMAIL_RE.test(email) || email.length > 200) {
      setContactState('invalid');
      return;
    }
    setContactState('sending');
    try {
      const res = await fetch('/api/messenger/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: config.key,
          origin: effectiveOrigin,
          originToken,
          anonymousId: anonId,
          conversationId,
          email,
        }),
      });
      if (!res.ok) throw new Error('contact_failed');
      setContactState('done');
    } catch {
      setContactState('invalid');
    }
  }

  async function uploadPhoto(file: File) {
    if (variant === 'preview' || !anonId || !conversationId) return;
    setAttachError(null);
    // Both of these are re-checked server-side against the actual bytes;
    // rejecting here just saves the shopper a pointless upload.
    if (file.size > MAX_ATTACHMENT_BYTES) return setAttachError(t.attachTooLarge);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return setAttachError(t.attachBadType);

    setUploading(true);
    const form = new FormData();
    form.append('key', config.key);
    form.append('origin', effectiveOrigin ?? '');
    form.append('originToken', originToken ?? '');
    form.append('anonymousId', anonId);
    form.append('conversationId', conversationId);
    form.append('clientKey', crypto.randomUUID());
    form.append('locale', locale);
    form.append('file', file);

    try {
      const res = await fetch('/api/messenger/attachment', { method: 'POST', body: form });
      const data = (await res.json().catch(() => null)) as
        | { userMessage?: WireMessage; note?: WireMessage | null }
        | null;
      if (!res.ok || !data?.userMessage) throw new Error('upload_failed');

      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.push(objectUrl);
      setLocalImages((prev) => ({ ...prev, [data.userMessage!.id]: objectUrl }));
      setMessages((prev) => [...prev, data.userMessage!, ...(data.note ? [data.note] : [])]);
    } catch {
      setAttachError(t.attachFailed);
    } finally {
      setUploading(false);
      // Same file twice in a row fires no change event unless the input is
      // cleared, and re-sending the same photo is a normal thing to do.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
        originToken,
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
                {localImages[m.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- object URL, no loader involved
                  <img
                    src={localImages[m.id]}
                    alt={t.attachImageAlt}
                    className="mb-1 max-h-56 w-full rounded-lg object-cover"
                  />
                ) : null}
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

        {/* Inline, never a modal: the composer stays usable and skipping
            costs nothing. Asked at most once, decided by the server. */}
        {askContact && (
          <div className="mx-auto w-full max-w-[92%] rounded-xl border border-border bg-card p-3">
            {contactState === 'done' ? (
              <p className="text-center text-[11px] text-muted-foreground" role="status">
                {t.contactThanks}
              </p>
            ) : (
              <form onSubmit={submitContact} className="grid gap-2">
                <p className="text-xs font-semibold">{t.contactTitle}</p>
                <label htmlFor="gc-msgr-contact" className="sr-only">
                  {t.contactLabel}
                </label>
                <input
                  id="gc-msgr-contact"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  value={contactDraft}
                  onChange={(e) => {
                    setContactDraft(e.target.value.slice(0, 200));
                    if (contactState === 'invalid') setContactState('idle');
                  }}
                  placeholder={t.contactPlaceholder}
                  aria-invalid={contactState === 'invalid'}
                  aria-describedby={contactState === 'invalid' ? 'gc-msgr-contact-error' : undefined}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                />
                {contactState === 'invalid' && (
                  <p id="gc-msgr-contact-error" className="text-[11px] text-destructive" role="alert">
                    {t.contactInvalid}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAskContact(false)}
                    className="rounded-full px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
                  >
                    {t.contactSkip}
                  </button>
                  <button
                    type="submit"
                    disabled={contactState === 'sending'}
                    className="rounded-full px-3 py-1.5 text-[11px] text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
                    style={{ backgroundColor: accent }}
                  >
                    {t.contactSend}
                  </button>
                </div>
              </form>
            )}
          </div>
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
          {config.attachmentsEnabled && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPhoto(file);
                }}
              />
              <button
                type="button"
                aria-label={t.attachAria}
                disabled={booting || uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex size-[42px] shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40"
              >
                <PaperclipIcon />
              </button>
            </>
          )}
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
        {(uploading || attachError) && (
          <p
            className={`mt-2 text-center text-[11px] ${attachError ? 'text-destructive' : 'text-muted-foreground'}`}
            role="status"
          >
            {attachError ?? t.attachUploading}
          </p>
        )}
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

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path
        d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.67 3.67 0 0 1 5.19 5.19l-8.49 8.48a1.83 1.83 0 0 1-2.6-2.59l7.79-7.78"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 rtl:-scale-x-100" fill="currentColor" aria-hidden="true">
      <path d="M3.4 20.4 21.85 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" />
    </svg>
  );
}
