'use client';

/* The same try-on runs inside a real store: the live demo store at
   grindctrl.myshopify.com, with its password and four of its products.
   Product names and prices are the store's own, so they stay in English. */

import * as React from 'react';
import Image from 'next/image';
import { ShopifyMark } from '@/components/brand-marks';
import { SiteBadge } from '@/components/site/chip';
import { ExtIcon, ShirtIcon } from '@/components/site/icons';
import { PasswordChip } from '@/components/site/password-chip';
import { trackClick } from '@/lib/analytics';
import type { TryOnTranslator } from '@/lib/try-on/i18n';
import { DEMO_STORE_URL } from './studio-parts';

const STORE_PRODUCTS = [
  { name: 'Riyadh Tie-Waist Open Abaya', price: '$95.00', handle: 'riyadh-tie-waist-open-abaya', image: '/landing/v15/st-riyadh-abaya.webp' },
  { name: 'Blacktop Ringer Tee', price: '$31.00', handle: 'blacktop-ringer-tee', image: '/landing/v15/st-blacktop-ringer.webp' },
  { name: 'Heavyweight Boxy Tee', price: '$28.00', handle: 'heavyweight-boxy-tee', image: '/landing/v15/st-boxy-tee.webp' },
  { name: 'Boxy Tee & Short Set', price: '$68.00', handle: 'boxy-tee-short-set', image: '/landing/v15/st-short-set.webp' },
];

export function StoreStrip({ t }: { t: TryOnTranslator }) {
  return (
    <section
      aria-label={t.pageStoreAria}
      className="mt-9 flex flex-col gap-5 rounded-[28px] border border-border bg-card p-[18px] lg:mt-14 lg:flex-row lg:items-center lg:gap-10 lg:p-[26px]"
    >
      <div className="min-w-0 lg:max-w-[360px]">
        <span lang="en" className="inline-flex items-center gap-2 text-[12.5px] font-bold text-muted-foreground">
          <ShopifyMark monochrome decorative className="size-[15px]" />
          grindctrl.myshopify.com
        </span>
        <h2 className="mt-2.5 text-2xl font-bold leading-[1.15] tracking-[-0.03em] lg:text-[28px]">{t.pageStoreTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <SiteBadge icon={<ShirtIcon size={13} strokeWidth={1.9} />}>{t.pageStoreBadge}</SiteBadge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <a
            href={DEMO_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick('cta_clicked', { cta: 'open_store', section: 'try_on_store' })}
            className="inline-flex h-12 items-center gap-[9px] whitespace-nowrap rounded-full bg-foreground px-[18px] text-[14.5px] font-bold text-background hover:brightness-110 lg:h-[50px] lg:px-5 lg:text-[15px]"
          >
            <ShopifyMark monochrome decorative className="size-[17px]" />
            {t.pageOpenStore}
            <ExtIcon size={14} strokeWidth={2} />
          </a>
          <PasswordChip
            copy={{
              label: t.pagePasswordLabel,
              copy: t.pagePasswordCopy,
              copied: t.pagePasswordCopied,
              selected: t.pagePasswordSelected,
              copyAria: t.pagePasswordCopyAria,
              copiedAria: t.pagePasswordCopiedAria,
            }}
          />
        </div>
      </div>
      <ul className="grid min-w-0 flex-1 grid-cols-2 gap-3.5 lg:grid-cols-4">
        {STORE_PRODUCTS.map((product) => (
          <li key={product.handle}>
            <a
              href={`${DEMO_STORE_URL}/products/${product.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick('cta_clicked', { cta: 'open_store', section: 'try_on_store' })}
              className="group block text-foreground"
            >
              <span className="relative block aspect-[4/5] overflow-hidden rounded-[14px] bg-gc-studio">
                <Image
                  src={product.image}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 180px, 45vw"
                  className="object-cover group-hover:brightness-95"
                />
              </span>
              <span lang="en" className="mt-2 block truncate text-[13px] font-semibold">
                {product.name}
              </span>
              <span lang="en" className="mt-0.5 block text-[12.5px] text-muted-foreground">
                {product.price}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
