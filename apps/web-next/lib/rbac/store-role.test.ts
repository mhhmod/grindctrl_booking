// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from '@/lib/messenger/db';
import { listTeamMemberships, shopRoleFor, teamOwnerIds, teamSiteRoleFor, type TeamMembership } from './store-role';

type Result = { data: unknown; error: { message: string } | null };

/* profiles and workspace_members as the membership read queries them, with
   every filter recorded so a dropped one fails the test. */
function stubClient(tables: { profiles: Result; workspace_members: Result }) {
  const filters: Array<[string, string, unknown]> = [];
  const client = {
    from(table: 'profiles' | 'workspace_members') {
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters.push([table, column, value]);
          return builder;
        },
        maybeSingle: async () => tables[table],
        then: (resolve: (value: Result) => unknown) => Promise.resolve(tables[table]).then(resolve),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, filters };
}

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

const row = (workspace: string, role: string | null, owner: string | null) => ({
  workspace_id: workspace,
  role,
  workspaces: owner ? { profiles: { clerk_user_id: owner } } : null,
});

describe('listTeamMemberships', () => {
  it("lists the person's teams on other accounts, with their role there", async () => {
    const { client, filters } = stubClient({
      profiles: { data: { id: 'profile-nour' }, error: null },
      workspace_members: {
        data: [
          row('ws-own', 'owner', 'user_nour'),
          row('ws-maison', 'member', 'user_hana'),
          row('ws-kids', 'admin', 'user_sara'),
          row('ws-shop', 'member', 'shop-demo.myshopify.com'),
          row('ws-odd', 'viewer', 'user_omar'),
          row('ws-orphan', 'member', null),
        ],
        error: null,
      },
    });
    restore = setMessengerServiceClientForTests(client);

    expect(await listTeamMemberships('user_nour')).toEqual([
      { workspaceId: 'ws-maison', ownerClerkUserId: 'user_hana', role: 'member' },
      { workspaceId: 'ws-kids', ownerClerkUserId: 'user_sara', role: 'admin' },
    ]);
    expect(filters).toEqual([
      ['profiles', 'clerk_user_id', 'user_nour'],
      ['workspace_members', 'profile_id', 'profile-nour'],
    ]);
  });

  it('fails closed to no teams', async () => {
    restore = setMessengerServiceClientForTests(
      stubClient({
        profiles: { data: { id: 'profile-nour' }, error: null },
        workspace_members: { data: null, error: { message: 'boom' } },
      }).client,
    );
    expect(await listTeamMemberships('user_nour')).toEqual([]);
  });

  it('has no teams without a profile', async () => {
    restore = setMessengerServiceClientForTests(
      stubClient({ profiles: { data: null, error: null }, workspace_members: { data: [], error: null } }).client,
    );
    expect(await listTeamMemberships('user_new')).toEqual([]);
  });
});

describe('store roles', () => {
  const teams: TeamMembership[] = [
    { workspaceId: 'ws-maison', ownerClerkUserId: 'user_hana', role: 'member' },
    { workspaceId: 'ws-maison-2', ownerClerkUserId: 'user_hana', role: 'admin' },
    { workspaceId: 'ws-kids', ownerClerkUserId: 'user_sara', role: 'member' },
  ];

  it("makes a shop's owner its owner, and a teammate their strongest role", () => {
    expect(shopRoleFor('user_hana', 'user_hana', [])).toBe('owner');
    expect(shopRoleFor('user_nour', 'user_hana', teams)).toBe('admin');
    expect(shopRoleFor('user_nour', 'user_sara', teams)).toBe('member');
    expect(shopRoleFor('user_nour', 'user_omar', teams)).toBeNull();
    expect(shopRoleFor('user_nour', null, teams)).toBeNull();
  });

  it("gives a site the role of the team whose workspace holds it", () => {
    expect(teamSiteRoleFor('ws-kids', teams)).toBe('member');
    expect(teamSiteRoleFor('ws-maison-2', teams)).toBe('admin');
    expect(teamSiteRoleFor('ws-elsewhere', teams)).toBeNull();
  });

  it('names each team owner once', () => {
    expect(teamOwnerIds(teams)).toEqual(['user_hana', 'user_sara']);
  });
});
