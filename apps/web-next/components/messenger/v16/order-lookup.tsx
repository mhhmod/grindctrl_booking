'use client';

import { useId, useState } from 'react';
import type { PanelCopy } from '@/components/messenger/i18n';
import type { MessengerLocale } from '@/lib/messenger/types';
import { normalizeOrderNumber, ORDER_CONTACT_EMAIL_RE, type OrderCard } from '@/lib/messenger/order-card';
import { formatStorePrice } from '@/lib/try-on/store-product';
import { intlLocale } from '@/lib/copy/rules';

/* The guest order lookup inside the chat and the order card (Chat-More,
   Chat-Order). The form checks the shape of what was typed and nothing
   else; whether the order and the email match is the server's to say, in
   one sentence whatever went wrong. The card shows only what the lookup
   returned from the store's own order data. */

export function OrderLookupForm({
  t,
  busy,
  onSubmit,
  onCancel,
}: {
  t: PanelCopy;
  busy: boolean;
  onSubmit: (orderNumber: string, contact: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [problem, setProblem] = useState<'number' | 'contact' | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const number = normalizeOrderNumber(orderNumber);
    if (!number) return setProblem('number');
    const email = contact.trim();
    if (email.length > 254 || !ORDER_CONTACT_EMAIL_RE.test(email)) return setProblem('contact');
    setProblem(null);
    onSubmit(number, email);
  }

  const field =
    'mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border border-border bg-card p-3.5" aria-busy={busy}>
      <label className="block text-xs font-medium" htmlFor={`${id}-number`}>
        {t.orderNumberLabel}
        <input
          id={`${id}-number`}
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          aria-invalid={problem === 'number' || undefined}
          aria-describedby={problem === 'number' ? `${id}-problem` : undefined}
          className={field}
          placeholder="1027"
        />
      </label>
      <label className="block text-xs font-medium" htmlFor={`${id}-contact`}>
        {t.orderContactLabel}
        <input
          id={`${id}-contact`}
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          aria-invalid={problem === 'contact' || undefined}
          aria-describedby={problem === 'contact' ? `${id}-problem` : undefined}
          className={field}
          placeholder="you@example.com"
        />
      </label>
      {problem && (
        <p id={`${id}-problem`} role="alert" className="text-xs text-[var(--gc-danger,#9b2c1f)]">
          {problem === 'number' ? t.orderNumberInvalid : t.contactInvalid}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 flex-1 rounded-full bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {busy ? t.findingOrder : t.findOrder}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.contactSkip}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t.orderPrivacy}</p>
    </form>
  );
}

function day(iso: string, locale: MessengerLocale, withWeekday = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(intlLocale(locale), {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function OrderCardView({ card, t, locale }: { card: OrderCard; t: PanelCopy; locale: MessengerLocale }) {
  const stageTone =
    card.stage === 'delivered'
      ? 'bg-[var(--gc-success-soft,#e3efe5)] text-[var(--gc-success,#2f6b3a)]'
      : card.stage === 'cancelled'
        ? 'bg-muted text-muted-foreground'
        : 'bg-[var(--gc-attention-soft,#f6ead3)] text-[var(--gc-attention,#8a5a12)]';
  const money = (minor: number) => (card.currency ? formatStorePrice(minor, card.currency, locale) : null);
  return (
    <div className="w-full max-w-[85%] space-y-3 rounded-2xl border border-border bg-card p-3.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold" dir="ltr">{card.name}</p>
          <p className="text-[11px] text-muted-foreground">{day(card.placedAt, locale)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${stageTone}`}>{t.orderStage[card.stage]}</span>
      </div>
      {card.estimatedDelivery && (
        <p className="text-xs font-medium">{t.orderArrives(day(card.estimatedDelivery, locale, true))}</p>
      )}
      <ul className="space-y-1">
        {card.items.map((item, index) => (
          <li key={index} className="flex justify-between gap-3 text-xs">
            <span dir="auto" className="min-w-0 truncate">{item.title}</span>
            <span className="shrink-0 text-muted-foreground" dir="ltr">× {item.quantity}</span>
          </li>
        ))}
      </ul>
      {card.timeline.length > 0 && (
        <ol className="space-y-1.5 border-s border-border ps-3">
          {card.timeline.map((step) => (
            <li key={step.kind} className="flex justify-between gap-3 text-xs">
              <span>
                {step.kind === 'placed'
                  ? t.orderPlaced
                  : step.kind === 'shipped'
                    ? t.orderShipped(step.carrier ?? null)
                    : step.kind === 'out_for_delivery'
                      ? t.orderOutForDelivery
                      : t.orderDelivered}
              </span>
              <span className="shrink-0 text-muted-foreground">{day(step.at, locale)}</span>
            </li>
          ))}
        </ol>
      )}
      {(card.cashDue || card.totalMinor !== undefined) && (
        <div className="space-y-1 border-t border-border pt-2 text-xs">
          {card.totalMinor !== undefined && money(card.totalMinor) && (
            <p className="flex justify-between gap-3">
              <span>{t.orderTotal}</span>
              <span className="font-medium">{money(card.totalMinor)}</span>
            </p>
          )}
          {card.cashDue && (
            <p className="flex justify-between gap-3 font-medium">
              <span>{t.orderCashDue}</span>
              {card.amountDueMinor !== undefined && money(card.amountDueMinor) && <span>{money(card.amountDueMinor)}</span>}
            </p>
          )}
        </div>
      )}
      {card.trackingUrl && (
        <a
          href={card.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-xs font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t.orderTrack(card.carrier)}
        </a>
      )}
    </div>
  );
}
