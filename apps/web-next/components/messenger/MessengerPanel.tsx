'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerLocale } from '@/lib/messenger/types';
import type { PublicHandoffAlert } from '@/lib/messenger/handoff-alert';
import { getPanelCopy } from './i18n';
import { MessageText } from './message-text';
import {
  cityTime,
  confirmMessage,
  formatTeamTime,
  handoffCard,
  mergeMessages,
  type PanelTeam,
} from './panel-state';

/* The shopper-facing messenger surface. Rendered inside an iframe on
   grindctrl.cloud/embed/messenger so merchant theme CSS can never reach it.
   Everything visual derives from the published config payload + theme
   tokens; nothing here reads localStorage beyond the session keys below. */

const ANON_KEY = (key: string) => `gc_msgr_${key}_anon`;
const CONV_KEY = (key: string) => `gc_msgr_${key}_conv`;

/* Matches what /api/messenger/sync documents and is rate-limited for
   (10 requests per 10 s per client). While a person is on the other end,
   a 15 s poll made a merchant's reply take up to 15 s (21 s measured live)
   to appear, so the panel polls faster only for those conversations. */
const SYNC_INTERVAL_MS = 15_000;
const LIVE_SYNC_INTERVAL_MS = 4_000;
const LIVE_STATUSES = new Set(['handoff_requested', 'handoff_active']);
/** How long the panel waits for the loader's shopper token before loading the conversation without it. */
const IDENTITY_WAIT_MS = 3_000;

export interface WireMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  author?: 'ai' | 'human' | 'system' | 'shopper';
  escalated?: boolean;
  /** This reply's own 👍/👎 from the shopper, if given. Server-supplied —
     reading it directly is the given state, so no client-side set needed. */
  feedback?: 'up' | 'down';
  pending?: boolean;
  failed?: boolean;
  /** The key this message was sent with; Retry sends it again with it. */
  clientKey?: string;
  /** Offline: waiting in the outbox, sent in order when back online. */
  queued?: boolean;
  /** The assistant could not answer; the message is saved (N24). */
  saved?: boolean;
}

type SendOutcome = 'sent' | 'queued' | 'failed';

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

/* Width cannot identify touch input: desktop chat also lives in a narrow iframe. */
function hasCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
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
  previewMessages,
  previewStatus,
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
  /** Preview only. Seeds the thread/handoff state the dashboard preview-frame
   *  wants to demo (e.g. a handoff banner) without a network round trip.
   *  Ignored in live mode — the real panel's state comes from bootstrap. */
  previewMessages?: WireMessage[];
  /** Preview only. See previewMessages. */
  previewStatus?: string;
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
  const [status, setStatus] = useState<string | null>(variant === 'preview' ? (previewStatus ?? null) : null);
  const [messages, setMessages] = useState<WireMessage[]>(variant === 'preview' ? (previewMessages ?? []) : []);
  const [booting, setBooting] = useState(variant === 'preview' ? false : true);
  const [bootError, setBootError] = useState(false);
  const [fullBleed, setFullBleed] = useState(false);
  const [typing, setTyping] = useState(false);
  /* Staff-side presence: true while the moderator is actively composing a
     reply (freshness is decided server-side per read). Independent of the
     send()-driven `typing` above — the dots show when EITHER is true. */
  const [staffTyping, setStaffTyping] = useState(false);

  /* Whether someone was really alerted about the handoff, and when the team
     is in (v16 phase zero items 6 and 7). */
  const [alert, setAlert] = useState<PublicHandoffAlert | null>(null);
  const [team, setTeam] = useState<PanelTeam | null>(config.team ?? null);
  const afterHoursMode = config.features?.includes('n23_after_hours') ?? false;
  /* The v16 Store Chat (03-store-chat.md): the loader opens it as a sheet or
     a docked panel; Escape here closes it, and opening it moves focus into
     the composer. */
  const v16Chat = config.features?.includes('v16_chat') ?? false;
  /* The assistant could not answer the last message (N24). */
  const [assistantDown, setAssistantDown] = useState(false);
  const [handingOff, setHandingOff] = useState(false);
  /* Offline outbox (item 8): messages wait and go out in order. */
  const [online, setOnline] = useState(true);
  const messagesRef = useRef<WireMessage[]>([]);
  const flushingRef = useRef(false);
  /* The outbox flush, for effects that must not re-bind on every render. */
  const flushRef = useRef<() => Promise<void>>(async () => {});
  /* The shopper's cart, for the big-order rule (n25_handoff_rules, phase
     zero item 10). The loader reads it on the store's own page; the panel
     posts it whenever it changes. */
  const cartWanted = variant === 'live' && (config.features?.includes('n25_handoff_rules') ?? false);
  const [cart, setCart] = useState<Record<string, unknown> | null>(null);
  const postedCartRef = useRef<string | null>(null);

  /* Composer */
  const [draft, setDraft] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /* The v16 loader asks for the composer as it opens the panel, often
     before the conversation has loaded; the request waits until it has. */
  const focusRequested = useRef(false);

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

  /* The storefront loader (public/widget/v1/messenger.js) generates the
     shopper's anonId and, once identified, a signed shopper token -- both on
     its own origin, before this iframe exists. Storage cannot cross that
     origin boundary, so the loader forwards the anonId as an iframe URL param,
     like key/locale/origin, and the token over postMessage (below), including
     one that arrives after the iframe already loaded. shopperTokenRef is a
     ref, not state: a late top-up must reach the next send() call without
     forcing a re-bootstrap. */
  const urlAnonId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('anonId');
  }, []);
  const shopperTokenRef = useRef<string | null>(
    // Only loaders cached from before the handshake below still put it here.
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('shopperToken') : null,
  );
  /* The loader keeps the token out of the address: `identity=1` says one is
     coming over postMessage, so bootstrap waits for it rather than loading
     the conversation as nobody, which the server would take for a logout. */
  const identityExpected = useMemo(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('identity') === '1',
    [],
  );
  const identityArrived = useRef<(() => void) | null>(null);

  /* The panel cannot close itself: the loader created and positions the
     iframe, so only it can hide it. postMessage is the one channel across
     that boundary; the loader accepts the request only from this exact
     window, so nothing else on the page can trigger it. */
  const closePanel = useCallback(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    window.parent.postMessage({ type: 'grindctrl-messenger:close' }, '*');
  }, []);

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
        // The loader's anonId is what a verified shopper token is bound to
        // (see lib/messenger/identity.ts's sid claim) -- adopt it over our
        // own independently-generated one whenever the loader supplied it.
        const anonymousId = urlAnonId ?? storedAnon ?? undefined;
        if (identityExpected && !shopperTokenRef.current && window.parent !== window) {
          await new Promise<void>((resolve) => {
            const timer = window.setTimeout(resolve, IDENTITY_WAIT_MS);
            identityArrived.current = () => {
              window.clearTimeout(timer);
              resolve();
            };
            // No secret in the request; the token comes back only to our origin.
            window.parent.postMessage({ type: 'grindctrl-messenger:identity-request' }, '*');
          });
          identityArrived.current = null;
          if (cancelled) return;
        }
        const res = await fetch('/api/messenger/bootstrap', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            key: config.key,
            origin: effectiveOrigin,
            originToken,
            anonymousId,
            conversationId: storedConv ?? undefined,
            shopperToken: shopperTokenRef.current ?? undefined,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          anonymousId: string;
          conversationId: string;
          status: string;
          staffTyping?: boolean;
          alert?: PublicHandoffAlert | null;
          messages: WireMessage[];
        };
        if (cancelled) return;
        localStorage.setItem(ANON_KEY(config.key), data.anonymousId);
        localStorage.setItem(CONV_KEY(config.key), data.conversationId);
        setAnonId(data.anonymousId);
        setConversationId(data.conversationId);
        setStatus(data.status);
        setStaffTyping(data.staffTyping === true);
        setAlert(data.alert ?? null);
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
  }, [config.key, effectiveOrigin, identityExpected, originToken, urlAnonId, variant]);

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
          if (typeof data?.staffTyping === 'boolean') setStaffTyping(data.staffTyping);
          // A retried alert that went out later reaches the shopper here.
          if (data && 'alert' in data) setAlert(data.alert ?? null);
          if (!data?.messages?.length) {
            if (typeof data?.status === 'string') setStatus(data.status);
            return;
          }
          setStatus(data.status ?? null);
          /* By id: a staff reply arriving while a message is still sending,
             failed or waiting offline no longer wipes that message out. */
          setMessages((prev) => mergeMessages(prev, data.messages as WireMessage[]));
        })
        .catch(() => {});
      // Messages left waiting by a dropped connection go out on the next poll.
      if (navigator.onLine !== false && messagesRef.current.some((m) => m.queued)) void flushRef.current();
    }
    /* The events alone were never enough. This panel is an iframe, and a
       shopper who has asked a question and is waiting for an answer switches
       nothing and clicks nothing: visibilitychange does not fire because the
       tab stays visible, and focus does not fire because focus never leaves.
       So a reply typed by the merchant sat in the database until the shopper
       happened to tab away and back. Poll while visible — the interval this
       endpoint was documented and rate-limited for, and which was simply
       never written. */
    const timer = window.setInterval(
      sync,
      status && LIVE_STATUSES.has(status) ? LIVE_SYNC_INTERVAL_MS : SYNC_INTERVAL_MS,
    );
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, [config.key, conversationId, anonId, messages, effectiveOrigin, originToken, status]);

  useEffect(scrollToEnd, [messages.length, typing, staffTyping, scrollToEnd]);

  /* The loader sees the storefront's visual viewport; this iframe only sees
     its own layout viewport. It resizes our box before notifying us, including
     on iOS keyboard scroll/resize events that never reach window.resize. */
  useEffect(() => {
    if (variant !== 'live') return;
    function onParentMessage(event: MessageEvent) {
      if (window.parent === window || event.source !== window.parent) return;
      const data = event.data;
      // A token the loader only obtained after this iframe had already
      // loaded (e.g. the App Proxy identify round trip lands late). Stored
      // in the ref so the next send() picks it up without a re-bootstrap --
      // see send/route.ts's own "identity refresh" handling of a late token.
      if (data?.type === 'grindctrl-messenger:identify' && (typeof data.token === 'string' || data.token === null)) {
        if (typeof data.token === 'string') shopperTokenRef.current = data.token;
        // Bootstrap may be waiting for it; null means none is coming.
        identityArrived.current?.();
        return;
      }
      if (data?.type === 'grindctrl-messenger:cart') {
        if (data.cart && typeof data.cart === 'object' && !Array.isArray(data.cart)) setCart(data.cart);
        return;
      }
      if (data?.type === 'grindctrl-messenger:opened') {
        if (!v16Chat) return;
        const input = inputRef.current;
        if (input && !input.disabled) input.focus({ preventScroll: true });
        else focusRequested.current = true;
        return;
      }
      if (data?.type !== 'grindctrl-messenger:viewport' || typeof data.fullBleed !== 'boolean') return;
      setFullBleed(data.fullBleed);
      scrollToEnd();
    }
    window.addEventListener('message', onParentMessage);
    window.addEventListener('resize', scrollToEnd);
    // Request the initial layout after hydration, when the listener is ready.
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'grindctrl-messenger:ready' }, '*');
    }
    return () => {
      window.removeEventListener('message', onParentMessage);
      window.removeEventListener('resize', scrollToEnd);
    };
  }, [scrollToEnd, variant, v16Chat]);

  // Escape pressed inside the panel never reaches the store page.
  useEffect(() => {
    if (variant !== 'live' || !v16Chat) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closePanel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePanel, v16Chat, variant]);

  /* Ask the loader for the cart once the listener above is in place; it
     sends it again whenever the theme changes the cart. */
  useEffect(() => {
    if (!cartWanted || window.parent === window) return;
    window.parent.postMessage({ type: 'grindctrl-messenger:cart-request' }, '*');
  }, [cartWanted]);

  useEffect(() => {
    if (!cartWanted || !cart || !anonId || !conversationId) return;
    const signature = `${conversationId}:${JSON.stringify(cart)}`;
    if (postedCartRef.current === signature) return;
    postedCartRef.current = signature;
    void fetch('/api/messenger/cart', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: config.key, origin: effectiveOrigin, originToken, anonymousId: anonId, conversationId, cart }),
    })
      .then((res) => {
        if (!res.ok) postedCartRef.current = null;
      })
      .catch(() => {
        postedCartRef.current = null;
      });
  }, [cartWanted, cart, anonId, conversationId, config.key, effectiveOrigin, originToken]);

  /* Keep desktop keyboard focus, without opening a touch keyboard on boot
     (the loader can also preload this panel before the shopper opens it). */
  useEffect(() => {
    if (booting) return;
    if (focusRequested.current || !hasCoarsePointer()) inputRef.current?.focus();
    focusRequested.current = false;
  }, [booting]);

  /* The latest messages for the outbox, which runs outside a render. */
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * Sends one shopper message. A retry or an outbox send passes the message
   * it is sending again, so it keeps its place and its key: the server
   * stores it once and answers it once (phase zero item 8).
   */
  async function send(overrideText?: string, again?: WireMessage): Promise<SendOutcome> {
    const text = (again?.content ?? overrideText ?? draft).trim();
    if (variant === 'preview') return 'failed';
    if (!text || !anonId || !conversationId) return 'failed';
    if (!again) {
      setDraft('');
      resizeInput();
    }

    const clientKey = again?.clientKey ?? crypto.randomUUID();
    const optimistic: WireMessage = {
      id: again?.id ?? `pending-${clientKey}`,
      role: 'user',
      content: text,
      createdAt: again?.createdAt ?? new Date().toISOString(),
      clientKey,
      pending: true,
    };
    setMessages((prev) =>
      again ? prev.map((m) => (m.id === again.id ? optimistic : m)) : [...prev, optimistic],
    );

    // Offline: it waits in the outbox and goes out when the connection is back.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, queued: true } : m)));
      return 'queued';
    }

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
          shopperToken: shopperTokenRef.current ?? undefined,
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
            alert?: PublicHandoffAlert | null;
            team?: PanelTeam | null;
            saved?: boolean;
            assistant?: 'unavailable';
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

      const confirmed: WireMessage = { ...data.userMessage, saved: data.saved === true || undefined };
      setMessages((prev) => confirmMessage(prev, optimistic.id, confirmed));
      if (data.reply) setMessages((prev) => mergeMessages(prev, [data.reply!]));
      if (data.status) setStatus(data.status);
      if (data.askContact) setAskContact(true);
      if (data.alert !== undefined) setAlert(data.alert ?? null);
      if (data.team) setTeam(data.team);
      // N24: the assistant could not answer; offer to send it to the team.
      setAssistantDown(data.assistant === 'unavailable');
      return 'sent';
    } catch (error) {
      // A fetch that never reached us is a dropped connection, not a refusal.
      const dropped = error instanceof TypeError;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimistic.id ? { ...m, pending: false, ...(dropped ? { queued: true } : { failed: true }) } : m,
        ),
      );
      return dropped ? 'queued' : 'failed';
    } finally {
      setTyping(false);
      if (!again) inputRef.current?.focus();
    }
  }

  /** Sends what waited offline, in the order it was written. Stops at the
   *  first one that still cannot go out. */
  async function flushQueue() {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      for (const message of messagesRef.current.filter((m) => m.queued)) {
        if ((await send(undefined, message)) === 'queued') break;
      }
    } finally {
      flushingRef.current = false;
    }
  }

  useEffect(() => {
    flushRef.current = flushQueue;
  });

  useEffect(() => {
    if (variant !== 'live') return;
    const update = () => {
      setOnline(navigator.onLine !== false);
      if (navigator.onLine !== false) void flushRef.current();
    };
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [variant, anonId, conversationId]);

  function retryFailed(message: WireMessage) {
    // Same message, same key: the server answers it once however often the
    // shopper taps Retry.
    void send(undefined, message);
  }

  /** N24: the assistant could not answer; send the saved message to the
   *  team through the same alert flow as any handoff. */
  async function handOffSaved() {
    if (!anonId || !conversationId) return;
    setHandingOff(true);
    try {
      const res = await fetch('/api/messenger/handoff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: config.key,
          origin: effectiveOrigin,
          originToken,
          anonymousId: anonId,
          conversationId,
          reason: 'assistant_unavailable',
          locale,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        status?: string;
        alert?: PublicHandoffAlert | null;
        team?: PanelTeam | null;
        line?: WireMessage;
      } | null;
      if (!res.ok || !data?.ok) return;
      if (data.status) setStatus(data.status);
      if (data.alert !== undefined) setAlert(data.alert ?? null);
      if (data.team) setTeam(data.team);
      if (data.line) setMessages((prev) => mergeMessages(prev, [data.line!]));
      setAssistantDown(false);
    } catch {
      // The card stays, so the shopper can try again.
    } finally {
      setHandingOff(false);
    }
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

  /* Shared shape with giveFeedback below: same trust fields, plus the
     target message when rating one reply instead of the whole thread. */
  function postFeedback(rating: 'up' | 'down', messageId?: string) {
    return fetch('/api/messenger/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        key: config.key,
        origin: effectiveOrigin,
        originToken,
        anonymousId: anonId,
        conversationId,
        rating,
        ...(messageId ? { messageId } : {}),
      }),
    }).catch(() => {});
  }

  async function giveFeedback(rating: 'up' | 'down') {
    if (!anonId || !conversationId || feedbackGiven) return;
    setFeedbackGiven(true);
    await postFeedback(rating);
  }

  /* One-shot per message, mirroring the conversation rating's no-takebacks
     rule: the buttons unmount the moment feedback lands (optimistically),
     and the server refuses to flip a recorded vote. */
  async function giveMessageFeedback(messageId: string, rating: 'up' | 'down') {
    if (!anonId || !conversationId) return;
    setMessages((prev) => prev.map((m) => (m.id === messageId && !m.feedback ? { ...m, feedback: rating } : m)));
    await postFeedback(rating, messageId);
  }

  const placeholder = pickLocalizedSafe(config.behaviour.inputPlaceholder, locale, t.messagePlaceholderFallback);
  const welcomeTitle = pickLocalizedSafe(config.behaviour.welcomeTitle, locale, '');
  const welcomeSubtitle = pickLocalizedSafe(config.behaviour.welcomeSubtitle, locale, '');

  const showHandoffBanner =
    status === 'handoff_requested' || status === 'handoff_active' || status === 'closed';
  /* n23_after_hours: the assistant answers now, and the header says when the
     team is in. */
  const teamLine = !team
    ? t.assistantNow
    : team.open
      ? team.closesAt
        ? `${t.assistantNow} · ${t.teamHereUntil(formatTeamTime(team.closesAt, locale))}`
        : t.assistantNow
      : `${t.assistantNow} · ${team.opensAt ? t.teamAwayUntil(formatTeamTime(team.opensAt, locale)) : t.teamAway}`;
  const card = handoffCard(alert, afterHoursMode ? team : null);
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
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{config.storeName}</p>
          <p className="flex items-center gap-1.5 text-[11px] leading-tight text-muted-foreground">
            <span
              aria-hidden="true"
              className={`inline-block size-1.5 rounded-full ${config.available || afterHoursMode ? 'bg-primary' : 'bg-muted-foreground'}`}
            />
            {afterHoursMode && team ? teamLine : config.available ? t.aiNotice : t.offlineNote}
          </p>
        </div>

        {/* The only way out on a phone. The panel is full-bleed there, so it
            covers the launcher — the control that closes it everywhere else —
            and a shopper who opened the chat was stuck with it until they
            reloaded the store. The loader owns the iframe, so ask it to close
            rather than trying to hide ourselves. Rendered on every size: a
            close button in the corner of a chat window is what people reach
            for first regardless of screen. */}
        {variant === 'live' && (
          <button
            type="button"
            onClick={closePanel}
            aria-label={t.close}
            className={`-me-1.5 flex ${fullBleed ? 'size-11' : 'size-9'} shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </header>

      {/* Offline: what the shopper writes waits and goes out when the
          connection is back (phase zero item 8). */}
      {!online && (
        <p role="status" className="bg-foreground px-4 py-2 text-center text-[11px] text-background">
          {t.offlineBar}
        </p>
      )}

      {/* Thread */}
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-busy={booting}>
        {booting && (
          <div aria-hidden="true" className="max-w-[85%] space-y-2 rounded-2xl rounded-es-md border border-border bg-card px-3.5 py-3">
            <Skeleton className="h-3 w-3/4 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-1/2 motion-reduce:animate-none" />
          </div>
        )}
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
          /* metadata.author already distinguishes 'ai' from 'human' server-side
             (staffReply sets it, the AI paths set it) — a shopper reading a
             resolved thread previously had no way to tell them apart. */
          const senderLabel =
            !mine && m.author === 'human' ? t.humanSenderLabel : !mine && m.author === 'ai' ? t.aiSenderLabel : null;
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              {senderLabel && (
                <span className="mb-0.5 px-1 text-[10px] font-medium text-muted-foreground">{senderLabel}</span>
              )}
              <div
                className={
                  mine
                    ? 'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-ee-md px-3.5 py-2 text-sm text-white'
                    : 'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-es-md border border-border bg-card px-3.5 py-2 text-sm'
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
                <MessageText text={m.content} />
                {m.pending && <span className="ms-2 inline-block animate-pulse">…</span>}
                {m.queued && (
                  <span className="mt-1 block text-[11px] opacity-90" role="status">
                    {t.waitingToSend}
                  </span>
                )}
                {m.saved && (
                  <span className="mt-1 block text-[11px] opacity-90">{t.savedMark}</span>
                )}
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
              {/* Per-reply rating: assistant bubbles only, never the
                  shopper's own messages or system lines. Same emoji and
                  button language as the end-of-conversation rating below;
                  once rated, the buttons give way to the thanks line. */}
              {!mine &&
                (m.feedback ? (
                  <span className="mt-1 px-1 text-[11px] text-muted-foreground" role="status">
                    {t.feedbackThanks}
                  </span>
                ) : (
                  <span className="mt-1 flex items-center gap-1 px-1">
                    <button
                      type="button"
                      onClick={() => giveMessageFeedback(m.id, 'up')}
                      aria-label="Helpful"
                      className="rounded-full px-1.5 py-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      onClick={() => giveMessageFeedback(m.id, 'down')}
                      aria-label="Not helpful"
                      className="rounded-full px-1.5 py-0.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2"
                    >
                      👎
                    </button>
                  </span>
                ))}
            </div>
          );
        })}

        {(typing || staffTyping) && (
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

        {/* N24: the assistant could not answer; the message is saved and
            the team is one tap away. */}
        {assistantDown && status === 'open' && (
          <div className="mx-auto w-full max-w-[92%] rounded-xl border border-border bg-card p-3" role="status">
            <p className="text-xs font-semibold">{t.assistantDownTitle}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t.assistantDownBody}</p>
            <button
              type="button"
              onClick={() => void handOffSaved()}
              disabled={handingOff}
              className="mt-2 rounded-full px-3 py-1.5 text-[11px] text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              {t.sendToTeam}
            </button>
          </div>
        )}

        {/* While the team has it: only an alert that really went out says
            the team has the message (phase zero item 6). */}
        {status === 'handoff_requested' && (
          <div className="mx-auto w-full max-w-[92%] rounded-xl border border-border bg-card p-3 text-center" role="status">
            {card.kind === 'alerted' ? (
              <>
                <p className="text-xs font-semibold">{t.alertedTitle}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.alertedBody}</p>
              </>
            ) : card.kind === 'after_hours' ? (
              <>
                <p className="text-xs font-semibold">
                  {t.awayTitle(
                    card.opensAt ? formatTeamTime(card.opensAt, locale) : null,
                    card.timezone ? cityTime(card.timezone, locale) : null,
                  )}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.awayBody}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.stillHelp}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold">{t.savedTitle}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.savedBody}</p>
              </>
            )}
          </div>
        )}

        {showHandoffBanner && status !== 'handoff_requested' && (
          <p className="text-center text-[11px] text-muted-foreground" role="status">
            {status === 'handoff_active' ? t.teamReplied : t.resolved}
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
              // Touch Return inserts a newline; the explicit Send button submits.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !hasCoarsePointer()) {
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
        {/* No GrindCTRL line on the store in v16; the shopper is told who answers instead. */}
        <p className="mt-2 text-center text-[10px] text-muted-foreground">{v16Chat ? t.disclosure : t.poweredBy}</p>
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
