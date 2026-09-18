'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { SiteLocale } from '@/lib/landing/landing-i18n';
import { cn } from '@/lib/utils';
import { TRY_ON_IMAGE_SIZE, TRY_ON_RESULTS, type TryOnResult } from './try-on-results';

export type TryOnSwitcherCopy = {
  pickerLabel: string;
  resultAlt: (garment: string) => string;
  beforeLabel: string;
  garmentLabel: string;
  provenance: string;
};

/* The visitor picks a garment and sees the real generated result swap in,
   with the shopper photo and garment it came from beside it. Every result is
   rendered up front and cross-faded, so switching never waits on a network
   request and the frame never changes size. */
export function TryOnSwitcher({
  locale,
  copy,
  initialId = 'woman-linen-shirt',
  className,
}: {
  locale: SiteLocale;
  copy: TryOnSwitcherCopy;
  initialId?: TryOnResult['id'];
  className?: string;
}) {
  const [activeId, setActiveId] = useState<TryOnResult['id']>(initialId);
  const active = TRY_ON_RESULTS.find((item) => item.id === activeId) ?? TRY_ON_RESULTS[0];

  return (
    <div className={cn('grid min-w-0 gap-5', className)}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.34fr)] gap-3 sm:gap-4">
        <figure className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-muted shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)]">
          <div className="relative aspect-[4/5]">
            {TRY_ON_RESULTS.map((item) => (
              <Image
                key={item.id}
                src={item.result}
                alt={copy.resultAlt(item.name[locale])}
                width={TRY_ON_IMAGE_SIZE.width}
                height={TRY_ON_IMAGE_SIZE.height}
                sizes="(min-width: 1024px) 420px, 64vw"
                aria-hidden={item.id !== active.id}
                className={cn(
                  'absolute inset-0 size-full object-cover transition-opacity duration-300 ease-out motion-reduce:transition-none',
                  item.id === active.id ? 'opacity-100' : 'opacity-0',
                )}
              />
            ))}
          </div>
          <figcaption className="sr-only">{copy.provenance}</figcaption>
        </figure>

        <div className="grid min-w-0 content-start gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{copy.beforeLabel}</p>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-muted">
              <Image
                src={active.shopperPhoto}
                alt=""
                fill
                sizes="(min-width: 1024px) 140px, 22vw"
                className="object-cover"
              />
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{copy.garmentLabel}</p>
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-border bg-white">
              <Image
                src={active.garment}
                alt=""
                fill
                sizes="(min-width: 1024px) 140px, 22vw"
                className="object-contain p-1.5"
              />
            </div>
          </div>
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-medium text-foreground">{copy.pickerLabel}</legend>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {TRY_ON_RESULTS.map((item) => {
            const selected = item.id === active.id;
            return (
              <label
                key={item.id}
                className={cn(
                  'group relative grid min-w-0 cursor-pointer gap-1.5 rounded-xl border p-1.5 transition-[border-color,box-shadow] duration-150',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
                  selected ? 'border-foreground shadow-sm' : 'border-border hover:border-foreground/40',
                )}
              >
                <input
                  type="radio"
                  name="landing-try-on-garment"
                  value={item.id}
                  checked={selected}
                  onChange={() => setActiveId(item.id)}
                  className="sr-only"
                />
                <span className="relative block aspect-square overflow-hidden rounded-lg bg-white">
                  <Image src={item.garment} alt="" fill sizes="96px" className="object-contain p-1" />
                </span>
                <span className="truncate px-0.5 text-center text-[11px] font-medium leading-4 text-foreground/80">
                  {item.name[locale]}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="text-xs leading-5 text-muted-foreground">{copy.provenance}</p>
    </div>
  );
}
