import type { WidgetDomain } from '@/lib/types';

export const DOMAIN_STATUS_OPTIONS = ['pending', 'verified', 'failed', 'disabled'] as const;

export function normalizeDomainInput(value: string) {
  return value.trim().toLowerCase();
}

export function isValidDomainInput(value: string) {
  if (!value) return false;
  if (value === 'localhost' || value === '127.0.0.1') return true;

  if (value.includes('://') || value.includes('/') || value.includes(' ') || value.includes(':')) {
    return false;
  }

  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
}

export function getDomainStatusTone(status: WidgetDomain['verification_status']) {
  if (status === 'verified') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'failed') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  if (status === 'disabled') return 'border-zinc-700 bg-zinc-800 text-zinc-300';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
}
