import 'server-only';

import { callRpc } from '@/lib/adapters/rpc';
import type { WidgetDomain } from '@/lib/types';

export async function listDomains(clerkUserId: string, siteId: string) {
  return callRpc<WidgetDomain[]>('dashboard_list_domains', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
  });
}

export async function addDomain(clerkUserId: string, siteId: string, domain: string) {
  return callRpc<WidgetDomain>('dashboard_add_domain', {
    p_clerk_user_id: clerkUserId,
    p_site_id: siteId,
    p_domain: domain,
  });
}

export async function updateDomainStatus(clerkUserId: string, domainId: string, status: string) {
  return callRpc<WidgetDomain>('dashboard_update_domain_status', {
    p_clerk_user_id: clerkUserId,
    p_domain_id: domainId,
    p_status: status,
  });
}

export async function removeDomain(clerkUserId: string, domainId: string) {
  return callRpc<boolean>('dashboard_remove_domain', {
    p_clerk_user_id: clerkUserId,
    p_domain_id: domainId,
  });
}
