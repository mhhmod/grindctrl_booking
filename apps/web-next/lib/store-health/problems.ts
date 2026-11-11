import { buildYourStoreView, type CheckKey, type YourStoreFacts } from '@/lib/dashboard/your-store-model';
import { getYourStoreCopy } from '@/lib/dashboard/your-store-copy';

export const STORE_HEALTH_PROBLEMS = ['code_gone', 'tryon_out_of_looks', 'store_chat_down', 'product_details_missing', 'product_photos_blocked'] as const;
export type StoreHealthProblem = typeof STORE_HEALTH_PROBLEMS[number];

export function checkRowProblemKey(key: CheckKey | 'storeChat'): StoreHealthProblem | null {
  const keys: Partial<Record<CheckKey | 'storeChat', StoreHealthProblem>> = { code: 'code_gone', looks: 'tryon_out_of_looks', storeChat: 'store_chat_down', productDetails: 'product_details_missing', productPhotos: 'product_photos_blocked' };
  return keys[key] ?? null;
}

/** The dashboard owns every threshold and signal rule. In particular stale
 * code already covers an unreachable chat: do not invent a second outage.
 * The looks row also represents an inactive plan, which is not this alert. */
export function detectStoreProblems(facts: YourStoreFacts): StoreHealthProblem[] {
  const view = buildYourStoreView(facts, getYourStoreCopy('en'), 'en');
  return (view.check?.fix ?? []).flatMap((row) => {
    if (row.kind !== 'bad') return [];
    if (row.key === 'looks' && (!facts.tryOn?.planActive || facts.tryOn.looksLeft > 0)) return [];
    const key = checkRowProblemKey(row.key);
    return key ? [key] : [];
  });
}

export function storeHealthEmailsEnabled(settings: unknown): boolean {
  const root = settings as { store_health_notifications?: { emailOnFailure?: unknown } } | null;
  return root?.store_health_notifications?.emailOnFailure !== false;
}
