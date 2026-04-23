import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WidgetIntent } from '@/lib/types';

export async function listIntents(clerkUserId: string, siteId: string) {
  return callRpc<WidgetIntent[]>('dashboard_list_intents', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
  });
}
