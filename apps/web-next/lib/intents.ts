import type { WidgetIntent } from '@/lib/types';

export const INTENT_ACTION_OPTIONS = ['send_message', 'external_link', 'escalate'] as const;

export function getIntentActionLabel(actionType: string | null | undefined) {
  if (actionType === 'external_link') return 'External link';
  if (actionType === 'escalate') return 'Escalate';
  return 'Send message';
}

export function getNextIntentSortOrder(intents: WidgetIntent[]) {
  if (intents.length === 0) return 0;
  return Math.max(...intents.map((intent) => Number(intent.sort_order ?? 0))) + 1;
}

export function getIntentTone(actionType: string | null | undefined) {
  if (actionType === 'external_link') return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
  if (actionType === 'escalate') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  return 'border-zinc-700 bg-zinc-800 text-zinc-200';
}
