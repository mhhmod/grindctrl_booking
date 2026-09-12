'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';
import type { MessengerConfigSectionDiff, MessengerSection } from '@/lib/messenger/config';

/* Saving used to take two steps on two different screens: "Save draft" in an
   editor, then hunt for a "Publish" button that lived inside the Config
   version card on the Overview tab. Nothing on the editor said the change
   was not live, so the natural reading of "Draft saved" was "done" — and the
   store kept serving the old settings.

   So the second step follows you instead. This bar is rendered by the tab
   shell, not by any one panel, and appears on every tab the moment a draft
   exists. Sticky at the bottom: it stays reachable in a long editor without
   fighting the sticky page header, and lands under the thumb on a phone. */

const COPY = {
  en: {
    pending: 'Not live yet',
    detail: 'Your changes are saved but shoppers still see the old version.',
    publish: 'Publish to your store',
    publishing: 'Publishing…',
    done: 'Published — your store is serving the new version.',
    review: (count: number) => `Review ${count} ${count === 1 ? 'change' : 'changes'}`,
    on: 'On',
    off: 'Off',
    before: 'Before',
    after: 'After',
    items: (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`,
  },
  ar: {
    pending: 'لم يُنشر بعد',
    detail: 'تم حفظ تغييراتك لكن العملاء ما زالوا يرون النسخة القديمة.',
    publish: 'انشر على متجرك',
    publishing: 'جارٍ النشر…',
    done: 'تم النشر — متجرك يعرض النسخة الجديدة الآن.',
    review: (count: number) => `مراجعة ${count} تغييرات`,
    on: 'مفعّل',
    off: 'معطّل',
    before: 'قبل',
    after: 'بعد',
    items: (count: number) => `${count} عنصر`,
  },
} as const;

const SECTION_LABELS: Record<'en' | 'ar', Record<MessengerSection, string>> = {
  en: {
    appearance: 'Appearance',
    behaviour: 'Behaviour',
    ai: 'AI',
    notifications: 'Notifications',
    contactCapture: 'Contact capture',
    attachments: 'Attachments',
    orderLookup: 'Order lookup',
  },
  ar: {
    appearance: 'المظهر',
    behaviour: 'السلوك',
    ai: 'الذكاء الاصطناعي',
    notifications: 'الإشعارات',
    contactCapture: 'جمع بيانات التواصل',
    attachments: 'المرفقات',
    orderLookup: 'الاستعلام عن الطلبات',
  },
};

function humanizeField(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown, t: (typeof COPY)['en' | 'ar']): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? t.on : t.off;
  if (Array.isArray(value)) return t.items(value.length);
  if (typeof value === 'object' && 'en' in value && 'ar' in value &&
      typeof value.en === 'string' && typeof value.ar === 'string') return value.en;
  const text = String(value);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function PublishBar({
  locale,
  siteId,
  hasDraft,
  configDiff = [],
  actions,
}: {
  locale: string;
  siteId: string;
  hasDraft: boolean;
  /** Optional for hosts that do not yet supply published/draft snapshots. */
  configDiff?: MessengerConfigSectionDiff[];
  actions: Pick<MessengerHostActions, 'publishConfig'>;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
  const sectionLabels = SECTION_LABELS[locale === 'ar' ? 'ar' : 'en'];
  const changedSections = configDiff.filter((section) => section.changed);
  const changeCount = changedSections.reduce((count, section) => count + section.fields.length, 0);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  /* hasDraft lags a publish by one revalidation round trip, so the outcome we
     just received is more current than the prop. Rendering off the prop alone
     left a window where the publish had succeeded and the bar still read "Not
     live yet" with no acknowledgement — which looks exactly like the button
     having done nothing.

     The confirmation then has to survive the prop catching up, but must NOT
     survive the merchant editing something new. Only a false -> true edge is
     a genuinely new draft; the prop merely settling after a publish is not. */
  const hadDraft = useRef(hasDraft);
  useEffect(() => {
    if (hasDraft && !hadDraft.current) setResult(null);
    hadDraft.current = hasDraft;
  }, [hasDraft]);

  const published = result?.ok === true ? result : null;
  if (!hasDraft && !published) return null;

  function publish() {
    setResult(null);
    startTransition(async () => {
      const outcome = await actions.publishConfig(siteId);
      setResult(
        outcome.ok
          ? // The server knows things this component does not — e.g. that a
            // CDN needs a minute — so its message wins when it sends one.
            { ok: true, text: outcome.message ?? t.done }
          : { ok: false, text: outcome.error },
      );
    });
  }

  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-2 px-4 pb-4 sm:mx-0 sm:px-0">
      <div
        role={published ? 'status' : undefined}
        className={`flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border p-3 shadow-lg backdrop-blur sm:p-4 ${
          published
            ? 'border-emerald-500/40 bg-emerald-50/90 dark:bg-emerald-950/70'
            : 'border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/70'
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{published ? published.text : t.pending}</p>
          {!published && (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.detail}</p>
          )}
          {result && !result.ok && (
            <p role="alert" className="mt-0.5 text-xs text-destructive">
              {result.text}
            </p>
          )}
        </div>
        {!published && (
          <Button type="button" disabled={pending} onClick={publish} className="shrink-0">
            {pending ? t.publishing : t.publish}
          </Button>
        )}
        {!published && hasDraft && changedSections.length > 0 && (
          <details className="min-w-0 basis-full text-xs">
            <summary className="cursor-pointer rounded-sm py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t.review(changeCount)}
            </summary>
            <div className="grid max-h-[40dvh] min-w-0 gap-3 overflow-y-auto overscroll-contain py-2 [overflow-wrap:anywhere]">
              {changedSections.map(({ section, fields }) => (
                <section key={section} className="min-w-0">
                  <h3 className="font-semibold">{sectionLabels[section]}</h3>
                  <dl className="mt-1 grid gap-2">
                    {fields.map(({ key, before, after }) => (
                      <div key={key} className="min-w-0">
                        <dt className="font-medium"><bdi>{humanizeField(key)}</bdi></dt>
                        <dd className="mt-0.5 grid min-w-0 gap-1 text-muted-foreground">
                          <p><span>{t.before}</span>: <bdi>{formatValue(before, t)}</bdi></p>
                          <p><span>{t.after}</span>: <bdi>{formatValue(after, t)}</bdi></p>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
