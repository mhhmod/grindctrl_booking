'use client';

import React from 'react';
import { useState } from 'react';
import { CheckmarkCircle01Icon, Copy01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '@/components/icons';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
    >
      {copied ? <Icon icon={CheckmarkCircle01Icon} /> : <Icon icon={Copy01Icon} />}
      {copied ? 'Copied' : label}
    </button>
  );
}
