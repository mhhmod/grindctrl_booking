'use client';

import type { PanelCopy } from '../i18n';
import type { PageProduct } from './page-product';
import type { MessengerLocale } from '@/lib/messenger/types';
import { formatStorePrice, variantName } from '@/lib/try-on/store-product';

/* The v16 home (Chat-Home): the piece on the page with Try it on, the
   welcome the merchant wrote with the AI label, and four quick actions,
   each sending a clear first message answered like any other. Talk to a
   person sends a phrase the handoff reading recognises, so it starts a
   handoff at once. */
export function ChatHome({
  t,
  locale,
  product,
  welcomeTitle,
  welcomeSubtitle,
  disabled,
  onQuickAction,
  onTryOn,
}: {
  t: PanelCopy;
  locale: MessengerLocale;
  product: PageProduct | null;
  welcomeTitle: string;
  welcomeSubtitle: string;
  disabled: boolean;
  onQuickAction: (message: string) => void;
  onTryOn: () => void;
}) {
  const details = product
    ? [
        variantName(product.variantTitle, locale),
        product.priceMinor !== null && product.currency ? formatStorePrice(product.priceMinor, product.currency, locale) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className="space-y-5">
      {product && (
        <section aria-label={t.youreViewing} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          {product.imageUrl && (
            // The store's own product image, on its CDN.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">{t.youreViewing}</p>
            <p className="truncate text-sm font-semibold">{product.title}</p>
            {details && <p className="truncate text-xs text-muted-foreground">{details}</p>}
          </div>
          {product.tryOn && (
            <button
              type="button"
              onClick={onTryOn}
              className="min-h-11 shrink-0 rounded-full border border-border px-3 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.tryItOn}
            </button>
          )}
        </section>
      )}

      <div className="space-y-1 text-center">
        {welcomeTitle && <h2 className="text-base font-semibold">{welcomeTitle}</h2>}
        {welcomeSubtitle && <p className="text-sm text-muted-foreground">{welcomeSubtitle}</p>}
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t.storeAssistantAi}</p>
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {t.quickActions.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onQuickAction(action.message)}
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
