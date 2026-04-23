import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WidgetLead } from '@/lib/types';

export async function listLeads(clerkUserId: string, workspaceId: string, siteId?: string | null) {
  return callRpc<WidgetLead[]>('dashboard_list_leads', {
    p_clerk_user_id: clerkUserId,
    p_workspace_id: workspaceId,
    p_site_id: siteId ?? null,
  });
}
