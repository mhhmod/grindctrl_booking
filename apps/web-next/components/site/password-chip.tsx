'use client';

/* The demo store's password, easy to spot and one press to copy.

   Clipboard first. If the page or its frame refuses the clipboard, select the
   value and try execCommand('copy'). If that fails too, the value stays
   selected and the button says so, so Ctrl+C or a long press finishes the
   job. The result is announced politely. */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CopyIcon, KeyIcon, TickIcon } from './icons';

export const STORE_PASSWORD = '1';

export type PasswordChipCopy = {
  label: string;
  copy: string;
  copied: string;
  selected: string;
  copyAria: string;
  copiedAria: string;
};

export type CopyOutcome = 'copied' | 'selected';

function selectNode(node: HTMLElement | null): boolean {
  if (!node || typeof window === 'undefined' || !window.getSelection || !document.createRange) return false;
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/** Exported for tests: runs the three-step copy and reports what happened. */
export async function copyStorePassword(valueNode: HTMLElement | null): Promise<CopyOutcome> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(STORE_PASSWORD);
      return 'copied';
    }
  } catch {
    // Refused (permissions policy, insecure context or a sandboxed frame): fall through.
  }
  try {
    if (selectNode(valueNode) && typeof document.execCommand === 'function' && document.execCommand('copy')) {
      return 'copied';
    }
  } catch {
    // execCommand can throw in some browsers; the value is still selected.
  }
  selectNode(valueNode);
  return 'selected';
}

export function PasswordChip({
  copy,
  tone = 'light',
  className,
}: {
  copy: PasswordChipCopy;
  /** Dark sits on the ink closing band and the dark story sheet. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const valueRef = React.useRef<HTMLSpanElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [outcome, setOutcome] = React.useState<CopyOutcome | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onCopy = async () => {
    const result = await copyStorePassword(valueRef.current);
    setOutcome(result);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOutcome(null), 2200);
  };

  const dark = tone === 'dark';
  const buttonLabel = outcome === 'copied' ? copy.copied : outcome === 'selected' ? copy.selected : copy.copy;

  return (
    <span
      data-passchip=""
      className={cn(
        'inline-flex h-12 items-center gap-2.5 whitespace-nowrap rounded-full border pe-[5px] ps-3.5 text-[13px] font-semibold lg:h-[50px] lg:ps-4 lg:text-[13.5px]',
        dark
          ? 'border-background/30 bg-background/[0.06] text-background'
          : 'border-border bg-card/85 text-gc-text-2',
        className,
      )}
    >
      <KeyIcon size={16} strokeWidth={1.9} />
      <span>{copy.label}</span>
      <span
        ref={valueRef}
        lang="en"
        dir="ltr"
        data-passval=""
        onClick={() => selectNode(valueRef.current)}
        className={cn(
          'inline-flex h-[34px] min-w-[34px] cursor-text select-all items-center justify-center rounded-[10px] border-[1.5px] border-dashed px-[11px] text-lg font-extrabold',
          dark ? 'border-background bg-background text-foreground' : 'border-foreground bg-card text-foreground',
        )}
      >
        {STORE_PASSWORD}
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={outcome === 'copied' ? copy.copiedAria : copy.copyAria}
        className={cn(
          'inline-flex h-[38px] items-center gap-1.5 rounded-full px-[13px] text-[13px] font-bold lg:h-10 lg:px-3.5',
          dark ? 'bg-background text-foreground' : 'bg-foreground text-background',
        )}
      >
        {outcome === 'copied' ? <TickIcon size={15} strokeWidth={1.9} /> : <CopyIcon size={15} strokeWidth={1.9} />}
        {buttonLabel}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {outcome === 'copied' ? copy.copiedAria : outcome === 'selected' ? copy.selected : ''}
      </span>
    </span>
  );
}
