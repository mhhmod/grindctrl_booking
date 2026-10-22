// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  flags: vi.fn(async (): Promise<string[]> => []),
  tables: {} as Record<string, { data: unknown; error: { message: string } | null }>,
  calls: [] as Array<[string, ...unknown[]]>,
}));

vi.mock('@/lib/messenger/provisioning', () => ({ requireSiteAccess: mocks.access }));
vi.mock('@/lib/flags/store-flags', () => ({
  flagStoreForSite: (site: { id: string }) => ({ widgetSiteId: site.id }),
  storeFlags: mocks.flags,
}));
vi.mock('@/lib/messenger/db', () => {
  class Query {
    constructor(readonly table: string) {}
    select(columns: string) { mocks.calls.push(['select', this.table, columns]); return this; }
    eq(column: string, value: unknown) { mocks.calls.push(['eq', this.table, column, value]); return this; }
    limit() { return this; }
    maybeSingle() { return this; }
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(mocks.tables[this.table] ?? { data: null, error: null }).then(resolve);
    }
  }
  return { getMessengerServiceClient: () => ({ from: (table: string) => new Query(table) }) as unknown as SupabaseClient };
});

import { getTeamFacts } from './team-data';

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const MEMBERS = [
  { profile_id: 'p1', role: 'owner', profiles: { first_name: 'Hana', last_name: 'Adel', email: 'hana@maisonnoor.com' } },
  { profile_id: 'p2', role: 'member', profiles: { first_name: ' ', last_name: null, email: 'user_2@users.noreply.clerk.dev' } },
  { profile_id: 'p3', role: 'viewer', profiles: { first_name: 'Ghost', last_name: null, email: 'ghost@example.com' } },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls = [];
  mocks.flags.mockResolvedValue(['n23_after_hours']);
  mocks.tables = { workspace_members: { data: MEMBERS, error: null } };
  mocks.access.mockResolvedValue({
    id: SITE_ID,
    workspace_id: 'ws_1',
    domain: 'grindctrl.myshopify.com',
    settings_json: {
      messenger_notifications: { emailOnHandoff: true, recipients: ['desk@maisonnoor.com'] },
      messenger_behaviour: {
        availabilityMode: 'hours',
        availabilityTimezone: 'Africa/Cairo',
        availabilityHours: [{ day: 5, startMinute: 840, endMinute: 1320 }],
      },
    },
  });
});

describe('getTeamFacts', () => {
  it('reads the team of the store’s Store Chat site after checking the person may manage it', async () => {
    const facts = await getTeamFacts({ userId: 'user_1', siteId: SITE_ID, shopDomain: 'grindctrl.myshopify.com' });
    expect(mocks.access).toHaveBeenCalledWith('user_1', SITE_ID, 'team');
    expect(mocks.calls).toContainEqual(['eq', 'workspace_members', 'workspace_id', 'ws_1']);
    expect(mocks.flags).toHaveBeenCalledWith({ widgetSiteId: SITE_ID });
    expect(facts).toEqual({
      // Clerk's placeholder address is no address, and an unknown role is nobody.
      people: [
        { profileId: 'p1', name: 'Hana Adel', email: 'hana@maisonnoor.com', role: 'owner' },
        { profileId: 'p2', name: null, email: null, role: 'member' },
      ],
      site: {
        emailOnHandoff: true,
        recipients: ['desk@maisonnoor.com'],
        availabilityMode: 'hours',
        availabilityTimezone: 'Africa/Cairo',
        availabilityHours: [{ day: 5, startMinute: 840, endMinute: 1320 }],
      },
      afterHours: true,
    });
  });

  it('refuses a person who may not manage the team', async () => {
    mocks.access.mockRejectedValue(new Error('Role not allowed'));
    await expect(getTeamFacts({ userId: 'user_1', siteId: SITE_ID, shopDomain: null })).rejects.toThrow('Role not allowed');
    expect(mocks.calls).toEqual([]);
  });

  it('reads the shop owner’s team for a shop without a Store Chat site', async () => {
    mocks.tables.tryon_shops = { data: { owner_clerk_user_id: 'user_owner' }, error: null };
    mocks.tables.workspaces = { data: { id: 'ws_owner' }, error: null };
    const facts = await getTeamFacts({ userId: 'user_1', siteId: null, shopDomain: 'kids.myshopify.com' });
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.calls).toEqual(
      expect.arrayContaining([
        ['eq', 'tryon_shops', 'shop_domain', 'kids.myshopify.com'],
        ['eq', 'workspaces', 'profiles.clerk_user_id', 'user_owner'],
        ['eq', 'workspace_members', 'workspace_id', 'ws_owner'],
      ]),
    );
    expect(facts).toMatchObject({ site: null, afterHours: false });
    expect(facts.people).toHaveLength(2);
  });

  it('has nobody for a shop with no owner yet, and throws when a read fails', async () => {
    mocks.tables.tryon_shops = { data: { owner_clerk_user_id: null }, error: null };
    expect(await getTeamFacts({ userId: 'user_1', siteId: null, shopDomain: 'kids.myshopify.com' })).toEqual({ people: [], site: null, afterHours: false });
    mocks.tables.workspace_members = { data: null, error: { message: 'timeout' } };
    await expect(getTeamFacts({ userId: 'user_1', siteId: SITE_ID, shopDomain: null })).rejects.toThrow('timeout');
  });
});
