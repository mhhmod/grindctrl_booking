'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import type { MessengerHostActions } from '@/lib/messenger/dashboard-actions-contract';

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
  },
  ar: {
    pending: 'لم يُنشر بعد',
    detail: 'تم حفظ تغييراتك لكن العملاء ما زالوا يرون النسخة القديمة.',
    publish: 'انشر على متجرك',
    publishing: 'جارٍ النشر…',
    done: 'تم النشر — متجرك يعرض النسخة الجديدة الآن.',
  },
} as const;

export function PublishBar({
  locale,
  siteId,
  hasDraft,
  actions,
}: {
  locale: string;
  siteId: string;
  hasDraft: boolean;
  actions: Pick<MessengerHostActions, 'publishConfig'>;
}) {
  const t = COPY[locale === 'ar' ? 'ar' : 'en'];
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
      </div>
    </div>
  );
}
