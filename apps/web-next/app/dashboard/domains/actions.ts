'use server';

import type { DomainsState } from '@/app/dashboard/domains/state';
import { addDomain, listDomains, removeDomain, updateDomainStatus } from '@/lib/adapters/domains';
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
    domains: await listDomains(clerkUserId, siteId),
    message,
    messageType: 'error',
    fieldError: fieldError ?? null,
  };
}

export async function addDomainAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<DomainsState> {
  const domain = normalizeDomainInput(String(formData.get('domain') ?? ''));

  if (!isValidDomainInput(domain)) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Enter a valid hostname like example.com.', 'Enter a valid hostname like example.com.');
  }

  try {
    await addDomain(context.clerkUserId, context.siteId, domain);
    return buildSuccessState(context.clerkUserId, context.siteId, `Added ${domain}.`);
  } catch (error) {
    return buildErrorState(context.clerkUserId, context.siteId, error instanceof Error ? error.message : 'Unable to add domain.');
  }
}

export async function updateDomainStatusAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<DomainsState> {
  const domainId = String(formData.get('domainId') ?? '');
  const status = String(formData.get('status') ?? '');

  if (!domainId || !DOMAIN_STATUS_OPTIONS.includes(status as (typeof DOMAIN_STATUS_OPTIONS)[number])) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Choose a valid domain status before saving.');
  }

  try {
    await updateDomainStatus(context.clerkUserId, domainId, status);
    return buildSuccessState(context.clerkUserId, context.siteId, 'Domain status updated.');
  } catch (error) {
    return buildErrorState(context.clerkUserId, context.siteId, error instanceof Error ? error.message : 'Unable to update domain status.');
  }
}

export async function removeDomainAction(context: { clerkUserId: string; siteId: string }, formData: FormData): Promise<DomainsState> {
  const domainId = String(formData.get('domainId') ?? '');

  if (!domainId) {
    return buildErrorState(context.clerkUserId, context.siteId, 'Choose a domain to remove.');
  }

  try {
    await removeDomain(context.clerkUserId, domainId);
    return buildSuccessState(context.clerkUserId, context.siteId, 'Domain removed.');
  } catch (error) {
    return buildErrorState(context.clerkUserId, context.siteId, error instanceof Error ? error.message : 'Unable to remove domain.');
  }
}
