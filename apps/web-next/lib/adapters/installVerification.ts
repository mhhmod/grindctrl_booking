import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WidgetInstallVerification } from '@/lib/types';

export async function getInstallVerification(clerkUserId: string, siteId: string) {
  return callRpc<WidgetInstallVerification | null>('dashboard_get_install_verification', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
  });
}
