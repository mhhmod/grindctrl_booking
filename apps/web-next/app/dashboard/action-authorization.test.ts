// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), owned: vi.fn(), limit: vi.fn(),
  updateSite: vi.fn(), listDomains: vi.fn(), addDomain: vi.fn(), updateDomain: vi.fn(), removeDomain: vi.fn(),
  listIntents: vi.fn(), createIntent: vi.fn(), updateIntent: vi.fn(), deleteIntent: vi.fn(),
}));
vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }));
vi.mock('@/lib/messenger/provisioning', () => ({
  requireOwnedSite: mocks.owned,
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('@/lib/request-rate-limit', async (original) => ({
  ...await original<typeof import('@/lib/request-rate-limit')>(), requireMerchantRateLimit: mocks.limit,
}));
vi.mock('@/lib/adapters/widgetSites', async (original) => ({
  ...await original<typeof import('@/lib/adapters/widgetSites')>(), updateWidgetSite: mocks.updateSite,
}));
vi.mock('@/lib/adapters/domains', () => ({
  listDomains: mocks.listDomains, addDomain: mocks.addDomain,
  updateDomainStatus: mocks.updateDomain, removeDomain: mocks.removeDomain,
}));
vi.mock('@/lib/adapters/intents', () => ({
  listIntents: mocks.listIntents, createIntent: mocks.createIntent,
  updateIntent: mocks.updateIntent, deleteIntent: mocks.deleteIntent,
}));

import { UnauthorizedError } from '@/lib/messenger/provisioning';
import { RequestRateLimitError } from '@/lib/request-rate-limit';
import { authorizeDashboardAction } from '@/lib/dashboard/action-authorization';
import { normalizeSettingsJson } from '@/lib/adapters/widgetSites';
import { saveBrandingAction } from './branding/actions';
import { saveLeadSettingsAction } from './leads/actions';
import { addDomainAction, updateDomainStatusAction, removeDomainAction } from './domains/actions';
import { createIntentAction, updateIntentAction, deleteIntentAction, reorderIntentAction } from './intents/actions';

const context = { clerkUserId: 'user_merchant', siteId: 'site_owned', currentSettings: normalizeSettingsJson({}) };
const actions = [
  ['branding', saveBrandingAction], ['leads', saveLeadSettingsAction],
  ['add domain', addDomainAction], ['update domain', updateDomainStatusAction], ['remove domain', removeDomainAction],
  ['create intent', createIntentAction], ['update intent', updateIntentAction],
  ['delete intent', deleteIntentAction], ['reorder intent', reorderIntentAction],
] as const;
const adapterCalls = [mocks.updateSite, mocks.listDomains, mocks.addDomain, mocks.updateDomain,
  mocks.removeDomain, mocks.listIntents, mocks.createIntent, mocks.updateIntent, mocks.deleteIntent];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: 'user_merchant' });
  mocks.owned.mockResolvedValue({ id: 'site_owned', domain: 'owned.myshopify.com' });
  mocks.limit.mockResolvedValue(undefined);
  mocks.listDomains.mockResolvedValue([{ id: 'domain_owned', widget_site_id: 'site_owned', domain: 'example.com' }]);
  mocks.listIntents.mockResolvedValue([{ id: 'intent_owned', widget_site_id: 'site_owned', label: 'Owned', sort_order: 0 }]);
});

describe('legacy dashboard direct-invocation boundaries', () => {
  it.each(actions)('%s rejects an unauthenticated call before any tenant lookup or RPC, including invalid forms', async (_label, action) => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect(await action(context, new FormData())).toMatchObject({ message: expect.stringContaining('sign in') });
    expect(mocks.owned).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();
    adapterCalls.forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });

  it.each(actions)('%s rejects a caller-supplied account ID that differs from Clerk', async (_label, action) => {
    expect(await action({ ...context, clerkUserId: 'user_victim' }, new FormData())).toMatchObject({ message: expect.stringContaining('permission') });
    expect(mocks.owned).not.toHaveBeenCalled();
    expect(mocks.limit).not.toHaveBeenCalled();
    adapterCalls.forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });

  it.each(actions)('%s rejects another tenant site before quota or adapter calls', async (_label, action) => {
    mocks.owned.mockRejectedValue(new UnauthorizedError());
    expect(await action(context, new FormData())).toMatchObject({ message: expect.stringContaining('permission') });
    expect(mocks.owned).toHaveBeenCalledWith('user_merchant', 'site_owned');
    expect(mocks.limit).not.toHaveBeenCalled();
    adapterCalls.forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });

  it.each(actions)('%s reports a safe limiter outage before all adapter calls', async (_label, action) => {
    mocks.limit.mockRejectedValue(new RequestRateLimitError(503, 30));
    expect(await action(context, new FormData())).toMatchObject({ message: expect.stringContaining('temporarily unavailable') });
    expect(mocks.limit).toHaveBeenCalledWith('shop:owned.myshopify.com');
    adapterCalls.forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });

  it('charges the verified shop only after ownership, or the verified account for a non-Shopify site', async () => {
    expect(await authorizeDashboardAction(context)).toBeNull();
    expect(mocks.owned.mock.invocationCallOrder[0]).toBeLessThan(mocks.limit.mock.invocationCallOrder[0]);
    mocks.owned.mockResolvedValueOnce({ id: 'site_owned', domain: 'custom.example.com' });
    expect(await authorizeDashboardAction(context)).toBeNull();
    expect(mocks.limit).toHaveBeenLastCalledWith('account:user_merchant');
  });

  it.each([
    ['update domain', updateDomainStatusAction, 'domainId', mocks.updateDomain],
    ['remove domain', removeDomainAction, 'domainId', mocks.removeDomain],
    ['update intent', updateIntentAction, 'intentId', mocks.updateIntent],
    ['delete intent', deleteIntentAction, 'intentId', mocks.deleteIntent],
  ] as const)('%s refuses a foreign child record even when the supplied site is owned', async (_label, action, field, write) => {
    const form = new FormData();
    form.set(field, 'foreign_record');
    form.set('status', 'verified');
    form.set('label', 'Valid input');
    form.set('actionType', 'send_message');
    form.set('messageText', 'Hello');
    expect(await action(context, form)).toMatchObject({ messageType: 'error', message: expect.stringContaining('belonging to this site') });
    expect(write).not.toHaveBeenCalled();
  });
});
