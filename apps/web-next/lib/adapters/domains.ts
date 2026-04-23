import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WidgetDomain } from '@/lib/types';

export async function listDomains(clerkUserId: string, siteId: string) {
  return callRpc<WidgetDomain[]>('dashboard_list_domains', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
  });
}
