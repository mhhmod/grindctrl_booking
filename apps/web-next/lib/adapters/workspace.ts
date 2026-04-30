import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WorkspaceBundle, WidgetSite } from '@/lib/types';

export async function getWorkspaceBundle(clerkUserId: string): Promise<WorkspaceBundle> {
  const data = await callRpc<{ workspace: WorkspaceBundle['workspace']; sites: WidgetSite[] } | null>('get_user_workspace', {
    p_clerk_user_id: clerkUserId,
  });

  if (!data?.workspace) {
    return {
      workspace: null,
      sites: [],
      role: null,
    };
  }

  const role = await callRpc<string | null>('dashboard_get_user_role', {
    p_clerk_user_id: clerkUserId,
    p_workspace_id: data.workspace.id,
  });

  return {
    workspace: data.workspace,
    sites: Array.isArray(data.sites) ? data.sites : [],
    role,
  };
}
