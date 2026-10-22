'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import type { PanelCopy } from '../i18n';

/* Chat-States (03-store-chat.md): the cards for a conversation that needs
   the team. Only an alert that really went out says the team has the
   message (phase zero item 6); after hours the card says when the team is
   back (item 7); when the assistant cannot answer, the message is saved and
   one tap sends it to the team (item 8). Every card asks where the team
   should reply when the store takes an address, and shows the one already
   given with Edit. The reply time appears only when it is measured
   (lib/messenger/team-reply-time.ts) and the team is in. WhatsApp waits for
   item 14, so the cards offer email alone. */

const CONTACT_EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const CheckIcon = () => (
  <Icon>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);
const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Icon>
);
const PauseIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 9v6M14 9v6" />
  </Icon>
);
const PeopleIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.9M17.5 13.6A5.5 5.5 0 0 1 20.5 19" />
  </Icon>
);

/** A round number a shopper reads at a glance, never a falsely exact one
 *  ("about 25 minutes", not "about 23"). */
export function friendlyMinutes(minutes: number): number {
  const whole = Math.max(1, Math.round(minutes));
  return whole <= 10 ? whole : Math.round(whole / 5) * 5;
}

/** The reply time, when it can honestly be said: measured, and the team in. */
export function replyTimeLine(
  t: PanelCopy,
  replyMinutes: number | null | undefined,
  teamOpen: boolean,
): string | null {
  return replyMinutes && teamOpen ? t.teamUsuallyReplies(friendlyMinutes(replyMinutes)) : null;
}

/** Where the team should reply: the address already given with Edit, or a
 *  field. Saving goes through the panel, which owns the session. */
export function ReplyAddress({
  t,
  heading,
  known,
  accent,
  onSave,
}: {
  t: PanelCopy;
  /** The question above the field; the after-hours card asks it in its body. */
  heading: string | null;
  known: string | null;
  accent: string;
  onSave: (email: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'invalid' | 'saved'>('idle');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const email = draft.trim();
    if (!CONTACT_EMAIL_RE.test(email) || email.length > 200) {
      setState('invalid');
      return;
    }
    setState('sending');
    if (await onSave(email)) {
      setState('saved');
      setEditing(false);
    } else {
      setState('invalid');
    }
  }

  return (
    <div className="grid gap-2 rounded-xl bg-card p-3">
      {heading && <p className="text-xs font-semibold">{heading}</p>}
      {known && !editing ? (
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate rounded-lg border border-border px-3 py-2 text-sm" dir="ltr">
            {known}
          </p>
          <button
            type="button"
            onClick={() => {
              setDraft(known);
              setState('idle');
              setEditing(true);
            }}
            className="min-h-10 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t.edit}
          </button>
          {state === 'saved' && (
            <span className="sr-only" role="status">
              {t.contactThanks}
            </span>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-2" noValidate>
          <label htmlFor="gc-msgr-reply-address" className="text-[11px] font-medium text-muted-foreground">
            {t.contactLabel}
          </label>
          <input
            id="gc-msgr-reply-address"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.slice(0, 200));
              if (state === 'invalid') setState('idle');
            }}
            placeholder={t.contactPlaceholder}
            aria-invalid={state === 'invalid'}
            aria-describedby={state === 'invalid' ? 'gc-msgr-reply-address-error' : undefined}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {state === 'invalid' && (
            <p id="gc-msgr-reply-address-error" className="text-[11px] text-destructive" role="alert">
              {t.contactInvalid}
            </p>
          )}
          <button
            type="submit"
            disabled={state === 'sending'}
            className="min-h-11 rounded-xl px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            style={{ backgroundColor: accent }}
          >
            {t.sendAddressToTeam}
          </button>
        </form>
      )}
    </div>
  );
}

/** Someone was really alerted (phase zero item 6). */
export function TeamHasItCard({
  t,
  replyLine,
  children,
}: {
  t: PanelCopy;
  replyLine: string | null;
  children?: ReactNode;
}) {
  return (
    <section
      role="status"
      className="grid gap-3 rounded-2xl border border-[var(--gc-success,#2f6b3a)]/25 bg-[var(--gc-success-soft,#e3efe5)] p-4"
    >
      <div className="flex items-start gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--gc-success,#2f6b3a)] text-white">
          <CheckIcon />
        </span>
        <div className="grid gap-1">
          <p className="text-sm font-semibold">{t.alertedTitle}</p>
          <p className="text-xs text-muted-foreground">{[replyLine, t.alertedBody].filter(Boolean).join(' ')}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Nobody was alerted, inside opening hours (alerts off or failing): the
 *  message is with the team's inbox, no more is promised. */
export function SavedForTeamCard({ t, children }: { t: PanelCopy; children?: ReactNode }) {
  return (
    <section role="status" className="grid gap-3 rounded-2xl border border-border bg-muted p-4">
      <div className="grid gap-1">
        <p className="text-sm font-semibold">{t.savedTitle}</p>
        <p className="text-xs text-muted-foreground">{t.savedBody}</p>
      </div>
      {children}
    </section>
  );
}

/** After hours: nobody pretends to be there (item 7). */
export function TeamAwayCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <section role="status" className="grid gap-3 rounded-2xl border border-border bg-muted p-4">
      <div className="flex items-start gap-2.5">
        <MoonIcon />
        <div className="grid gap-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{body}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/** The assistant could not answer; the message is saved (item 8). */
export function AssistantDownCard({
  t,
  replyLine,
  accent,
  busy,
  onSend,
}: {
  t: PanelCopy;
  /** The measured reply time, folded into the body when there is one. */
  replyLine: string | null;
  accent: string;
  busy: boolean;
  onSend: () => void;
}) {
  return (
    <section
      role="status"
      className="grid gap-3 rounded-2xl border border-[var(--gc-attention,#8a5a12)]/25 bg-[var(--gc-attention-soft,#f6ead3)] p-4"
    >
      <div className="flex items-start gap-2.5">
        <span className="text-[var(--gc-attention,#8a5a12)]">
          <PauseIcon />
        </span>
        <div className="grid gap-1">
          <p className="text-sm font-semibold">{t.assistantDownTitle}</p>
          <p className="text-xs text-muted-foreground">{[t.assistantDownBody, replyLine].filter(Boolean).join(' ')}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSend}
        disabled={busy}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        style={{ backgroundColor: accent }}
      >
        <PeopleIcon />
        {t.sendToTeam}
      </button>
    </section>
  );
}

/** "✓ Saved" under the shopper's own message, outside the bubble. */
export function SavedMark({ t }: { t: PanelCopy }) {
  return (
    <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" focusable="false">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      {t.savedMark}
    </span>
  );
}
