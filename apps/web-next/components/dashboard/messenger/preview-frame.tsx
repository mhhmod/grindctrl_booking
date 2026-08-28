'use client';

import React, { useState } from 'react';
import { MessengerPanel } from '@/components/messenger/MessengerPanel';
import { LauncherPreview } from './launcher-preview';
import type { PublicMessengerPayload } from '@/lib/messenger/public-api';
import type { MessengerLocale } from '@/lib/messenger/types';

/* Store preview for the editors. Renders the REAL shopper component in a
   device frame so what the merchant sees here is exactly what ships —
   there is no separate preview implementation to drift. */

export function PreviewFrame({
  payload,
  initialLocale,
}: {
  payload: PublicMessengerPayload;
  initialLocale: MessengerLocale;
}) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [locale, setLocale] = useState<MessengerLocale>(initialLocale);
  /* Closed is the honest default: it is the state every shopper sees, and
     the one whose settings (icon, label, size, corner) were previously
     invisible here — the preview only ever showed the opened panel. */
  const [open, setOpen] = useState(false);
  const t =
    initialLocale === 'ar'
      ? { closed: 'مغلق', opened: 'مفتوح', state: 'حالة الدردشة', hint: 'اضغط زر الدردشة لفتح المعاينة' }
      : { closed: 'Closed', opened: 'Open', state: 'Chat state', hint: 'Click the chat button to open the preview' };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {initialLocale === 'ar' ? 'معاينة مباشرة' : 'Live preview'}
        </p>
        <div className="flex gap-1" role="group" aria-label={initialLocale === 'ar' ? 'الجهاز واللغة' : 'Device and language'}>
          <Toggle active={device === 'desktop'} onClick={() => setDevice('desktop')}>
            {initialLocale === 'ar' ? 'سطح المكتب' : 'Desktop'}
          </Toggle>
          <Toggle active={device === 'mobile'} onClick={() => setDevice('mobile')}>
            {initialLocale === 'ar' ? 'جوال' : 'Mobile'}
          </Toggle>
          <span className="mx-1 w-px bg-border" aria-hidden="true" />
          <Toggle active={locale === 'en'} onClick={() => setLocale('en')}>
            EN
          </Toggle>
          <Toggle active={locale === 'ar'} onClick={() => setLocale('ar')}>
            AR
          </Toggle>
          <span className="mx-1 w-px bg-border" aria-hidden="true" />
          <Toggle active={!open} onClick={() => setOpen(false)}>
            {t.closed}
          </Toggle>
          <Toggle active={open} onClick={() => setOpen(true)}>
            {t.opened}
          </Toggle>
        </div>
      </div>

      <div
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className={
          device === 'mobile'
            ? 'relative mx-auto h-[520px] w-[300px] overflow-hidden rounded-[28px] border-[6px] border-zinc-700 bg-background shadow-xl'
            : 'relative h-[480px] overflow-hidden rounded-xl border border-border bg-background'
        }
      >
        {open ? (
          <MessengerPanel config={{ ...payload }} variant="preview" locale={locale} />
        ) : (
          /* A quiet stand-in for the merchant's page, so the launcher is
             judged against a page rather than floating in a void. */
          <div className="flex h-full flex-col gap-3 p-5" aria-hidden="true">
            <div className="h-3 w-1/3 rounded-full bg-muted" />
            <div className="h-24 rounded-lg bg-muted/60" />
            <div className="h-3 w-2/3 rounded-full bg-muted" />
            <div className="h-3 w-1/2 rounded-full bg-muted" />
            <div className="mt-auto h-9 w-32 rounded-lg bg-muted" />
          </div>
        )}
        {/* The launcher stays put whether the panel is open or closed, which
            is how it behaves on a real storefront. */}
        <LauncherPreview payload={payload} locale={locale} expanded={open} onClick={() => setOpen(!open)} />
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {open
          ? initialLocale === 'ar'
            ? 'معاينة بالمكوّن الحقيقي — انشر التغييرات لتظهر على متجرك.'
            : 'Rendered by the real widget component — publish to go live on your store.'
          : t.hint}
      </p>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 ${
        active ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-accent'
      }`}
    >
      {children}
    </button>
  );
}
