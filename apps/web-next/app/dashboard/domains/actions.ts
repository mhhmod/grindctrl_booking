'use server';

import type { DomainsState } from '@/app/dashboard/domains/state';
import { addDomain, listDomains, removeDomain, updateDomainStatus } from '@/lib/adapters/domains';
import { authorizeDashboardAction } from '@/lib/dashboard/action-authorization';
import { DOMAIN_STATUS_OPTIONS, isValidDomainInput, normalizeDomainInput } from '@/lib/domains';

async function buildSuccessState(clerkUserId: string, siteId: string, message: string): Promise<DomainsState> {
  return {
    domains: await listDomains(clerkUserId, siteId),
    message,
    messageType: 'success',
    fieldError: null,
  };
}

async function buildErrorState(clerkUserId: string, siteId: string, message: string, fieldError?: string | null): Promise<DomainsState> {
  return {
    domains: await listDomains(clerkUserId, siteId).catch(() => []),
    message,
    messageType: 'error',
    fieldError: fieldError ?? null,
  };
}

export async function addDomainAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<DomainsState> {
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { domains: [], message: authorizationError, messageType: 'error', fieldError: null };
  const domain = normalizeDomainInput(String(formData.get('domain') ?? ''));

  if (!isValidDomainInput(domain)) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Enter a valid hostname like example.com.', 'Enter a valid hostname like example.com.');
  }

  try {
    await addDomain(context.clerkUserId, context.siteId, domain);
    return await buildSuccessState(context.clerkUserId, context.siteId, `Added ${domain}.`);
  } catch {
    return buildErrorState(context.clerkUserId, context.siteId, 'Unable to add domain. Please refresh before trying again.');
  }
}

export async function updateDomainStatusAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<DomainsState> {
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { domains: [], message: authorizationError, messageType: 'error', fieldError: null };
  const domainId = String(formData.get('domainId') ?? '');
  const status = String(formData.get('status') ?? '');

  if (!domainId || !DOMAIN_STATUS_OPTIONS.includes(status as (typeof DOMAIN_STATUS_OPTIONS)[number])) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Choose a valid domain status before saving.');
  }

  try {
    const domains = await listDomains(context.clerkUserId, context.siteId);
    if (!domains.some((domain) => domain.id === domainId && domain.widget_site_id === context.siteId)) {
      return { domains, message: 'Choose a domain belonging to this site.', messageType: 'error', fieldError: null };
    }
    await updateDomainStatus(context.clerkUserId, domainId, status);
    return await buildSuccessState(context.clerkUserId, context.siteId, 'Domain status updated.');
  } catch {
    return buildErrorState(context.clerkUserId, context.siteId, 'Unable to update domain status. Please refresh before trying again.');
  }
}

export async function removeDomainAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<DomainsState> {
  const authorizationError = await authorizeDashboardAction(context);
  if (authorizationError) return { domains: [], message: authorizationError, messageType: 'error', fieldError: null };
  const domainId = String(formData.get('domainId') ?? '');

  if (!domainId) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Choose a domain to remove.');
  }

  try {
    const domains = await listDomains(context.clerkUserId, context.siteId);
    if (!domains.some((domain) => domain.id === domainId && domain.widget_site_id === context.siteId)) {
      return { domains, message: 'Choose a domain belonging to this site.', messageType: 'error', fieldError: null };
    }
    await removeDomain(context.clerkUserId, domainId);
    return await buildSuccessState(context.clerkUserId, context.siteId, 'Domain removed.');
  } catch {
    return buildErrorState(context.clerkUserId, context.siteId, 'Unable to remove domain. Please refresh before trying again.');
  }
}
