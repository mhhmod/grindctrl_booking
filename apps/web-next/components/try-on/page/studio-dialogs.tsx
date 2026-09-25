'use client';

/* The piece picker and the compare view. Both are Radix dialogs, the same
   primitive under components/ui/sheet.tsx: focus moves in, stays inside,
   Escape and the backdrop close them, focus returns to the button that
   opened them, and the page behind is locked. The Sheet wrapper is not used
   because the picker is a centred dialog on desktop and an inset bottom
   sheet on phones, which none of its fixed sides express. */

import * as React from 'react';
import Image from 'next/image';
import { Dialog } from 'radix-ui';
import { CheckIcon, XIcon } from '@/components/site/icons';
import type { TryOnTranslator } from '@/lib/try-on/i18n';
import { cn } from '@/lib/utils';
import { PIECE_ORDER, PIECES, type Look, type PieceKey } from './studio-state';

function DialogShell({
  open,
  onOpenChange,
  title,
  closeLabel,
  width,
  sheetOnPhones,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  width: string;
  sheetOnPhones?: boolean;
  children: React.ReactNode;
}) {
  /* These dialogs open from several buttons, so there is no single
     Dialog.Trigger for Radix to return focus to. Remember the opener as the
     dialog mounts and hand focus back to it on close. */
  const opener = React.useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="gc-anim-fade fixed inset-0 z-[60] bg-foreground/[0.32]" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
          className={cn(
            'gc-anim-in fixed z-[61] max-h-[calc(100svh-20px)] overflow-y-auto rounded-[26px] bg-background p-[18px] text-foreground shadow-[0_40px_80px_-30px_rgb(32_29_27/0.6)]',
            'inset-x-2.5 lg:inset-x-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2',
            sheetOnPhones ? 'bottom-2.5 lg:bottom-auto' : 'top-1/2 -translate-y-1/2',
            width,
          )}
        >
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={closeLabel}
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground hover:bg-foreground/[0.06]"
              >
                <XIcon size={16} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PiecePicker({
  t,
  open,
  onOpenChange,
  current,
  onPick,
}: {
  t: TryOnTranslator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: PieceKey;
  onPick: (piece: PieceKey) => void;
}) {
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={t.pageTryAnother}
      closeLabel={t.pageClose}
      width="lg:w-[460px]"
      sheetOnPhones
    >
      <p className="mb-3 text-[13px] leading-normal text-muted-foreground">{t.pagePickerNote}</p>
      <div className="flex flex-col gap-2">
        {PIECE_ORDER.map((key) => {
          const on = key === current;
          const copy = t.pagePieces[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(key)}
              className={cn(
                'flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] bg-card p-2 text-start text-foreground hover:brightness-[1.02]',
                on ? 'border-foreground' : 'border-transparent',
              )}
            >
              <span className="relative h-[72px] w-[58px] shrink-0 overflow-hidden rounded-xl bg-gc-studio">
                <Image src={PIECES[key].garment} alt="" fill unoptimized sizes="58px" className="object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{copy.name}</span>
                <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{copy.kind}</span>
              </span>
              {on ? <CheckIcon size={18} strokeWidth={2.2} /> : null}
            </button>
          );
        })}
      </div>
    </DialogShell>
  );
}

export function CompareDialog({
  t,
  open,
  onOpenChange,
  pair,
}: {
  t: TryOnTranslator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pair: [Look, Look] | null;
}) {
  return (
    <DialogShell
      open={open && Boolean(pair)}
      onOpenChange={onOpenChange}
      title={t.pageCompareTitle}
      closeLabel={t.pageClose}
      width="lg:w-[760px]"
    >
      {pair ? (
        <div className="mt-2 flex gap-3">
          {pair.map((look) => {
            const name = t.pagePieces[look.piece].name;
            return (
              <figure key={look.id} className="min-w-0 flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={look.image}
                  alt={name}
                  className="block h-[300px] w-full rounded-[18px] object-cover object-[50%_15%] lg:h-[460px]"
                />
                <figcaption className="mt-2 text-center text-sm font-bold">{name}</figcaption>
              </figure>
            );
          })}
        </div>
      ) : null}
    </DialogShell>
  );
}
