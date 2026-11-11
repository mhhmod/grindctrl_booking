// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ owner: vi.fn(), linked: vi.fn(), email: vi.fn(), eq: vi.fn(), row: { clerk_user_id: 'user_owner', dashboard_locale: 'ar' } as null | { clerk_user_id: string; dashboard_locale?: string }, error: null as unknown }));
vi.mock('@/lib/messenger/db', () => ({ getMessengerServiceClient: () => ({ from: () => ({ select: () => ({ eq: mocks.eq }) }) }) }));
vi.mock('@/lib/messenger/provisioning', () => ({ getSiteAssigneeProfileId: mocks.owner }));
vi.mock('@/lib/shopify/shop-links', () => ({ getShopOwnerClerkUserId: mocks.linked }));
vi.mock('@/lib/team/clerk-account', () => ({ getClerkAccountEmail: mocks.email }));
import { storeHealthOwner } from './owner';
beforeEach(() => {
  vi.clearAllMocks(); mocks.row = { clerk_user_id: 'user_owner', dashboard_locale: 'ar' }; mocks.error = null;
  mocks.eq.mockReturnValue({ maybeSingle: async () => ({ data: mocks.row, error: mocks.error }) });
  mocks.owner.mockResolvedValue('owner-profile'); mocks.linked.mockResolvedValue(null); mocks.email.mockResolvedValue('owner@example.com');
});
describe('health alert owner identity and dashboard language', () => {
  it('reuses the workspace owner profile and shared Clerk lookup, never admins or handoff overrides', async () => {
    expect(await storeHealthOwner({ workspace_id: 'ws', domain: 'lulu.example' })).toEqual({ email: 'owner@example.com', locale: 'ar' });
    expect(mocks.owner).toHaveBeenCalledWith('ws'); expect(mocks.eq).toHaveBeenCalledWith('id', 'owner-profile');
    expect(mocks.email).toHaveBeenCalledWith('user_owner');
  });
  it('uses the canonical linked owner for a shop-first installation and defaults English', async () => {
    mocks.linked.mockResolvedValue('user_linked'); mocks.row = { clerk_user_id: 'user_linked' };
    expect(await storeHealthOwner({ workspace_id: 'ws', domain: 'lulu.myshopify.com' })).toEqual({ email: 'owner@example.com', locale: 'en' });
    expect(mocks.eq).toHaveBeenCalledWith('clerk_user_id', 'user_linked'); expect(mocks.owner).not.toHaveBeenCalled();
  });
  it('skips an unclaimed shop placeholder or missing owner rather than alerting someone else', async () => {
    mocks.row = { clerk_user_id: 'shop-lulu.myshopify.com' };
    expect(await storeHealthOwner({ workspace_id: 'ws', domain: null })).toBeNull(); expect(mocks.email).not.toHaveBeenCalled();
    mocks.row = null; expect(await storeHealthOwner({ workspace_id: 'ws', domain: null })).toBeNull();
  });
  it('propagates a failed owner read', async () => {
    mocks.error = { message: 'private' };
    await expect(storeHealthOwner({ workspace_id: 'ws', domain: null })).rejects.toThrow('store health owner read failed');
  });
});
