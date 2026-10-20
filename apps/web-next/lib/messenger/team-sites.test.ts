// @vitest-environment node
/* Item 12: Store Chat sites for a store's team. The owner's own sites are
   listed and checked exactly as before; a teammate reaches the sites of the
   workspaces whose team they are on, read-only, and only for what their role
   may do. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { setMessengerServiceClientForTests } from './db';
import { RoleNotAllowedError } from '@/lib/rbac/dashboard-policy';

const listTeamMemberships = vi.hoisted(() => vi.fn());
vi.mock('@/lib/rbac/store-role', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rbac/store-role')>()),
  listTeamMemberships,
}));

import { listMessengerSitesReadOnly, listTeamSites, provisionableShopDomain, requireSiteAccess, UnauthorizedError } from './provisioning';

type Row = Record<string, unknown>;

const site = (id: string, workspace: string, domain: string | null): Row => ({
  id,
  workspace_id: workspace,
  name: id,
  embed_key: `gc_${id}`,
  status: 'active',
  domain,
  settings_json: {},
  settings_version: 1,
  settings_draft: null,
});

const SITES = [
  site('own-site', 'ws-own', 'mine.myshopify.com'),
  site('maison-site', 'ws-maison', 'maison.myshopify.com'),
  site('kids-site', 'ws-kids', 'kids.myshopify.com'),
];

/* Just enough of PostgREST for the listings: the bootstrap RPCs for the
   caller's own profile and workspace, and filtered reads. */
function stubClient() {
  const inFilters: Array<[string, unknown]> = [];
  const client = {
    rpc: async (name: string) => ({
      data: name === 'bootstrap_profile' ? { id: 'profile-nour', clerk_user_id: 'user_nour', email: 'n@x.com' } : { id: 'ws-own' },
      error: null,
    }),
    from(table: string) {
      const eq: Array<[string, unknown]> = [];
      let inList: [string, unknown[]] | null = null;
      const rows = () => {
        const base: Row[] =
          table === 'widget_sites' ? SITES
          : table === 'profiles' ? [{ id: 'profile-nour', clerk_user_id: 'user_nour' }]
          : table === 'workspaces' ? [{ id: 'ws-own', owner_profile_id: 'profile-nour' }]
          : [];
        return base.filter(
          (row) => eq.every(([c, v]) => row[c] === v) && (!inList || inList[1].includes(row[inList[0]])),
        );
      };
      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        eq: (column: string, value: unknown) => {
          eq.push([column, value]);
          return builder;
        },
        in: (column: string, values: unknown[]) => {
          inList = [column, values];
          inFilters.push([column, values]);
          return builder;
        },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(resolve),
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, inFilters };
}

let restore: () => void;
let stub: ReturnType<typeof stubClient>;
beforeEach(() => {
  stub = stubClient();
  restore = setMessengerServiceClientForTests(stub.client);
  listTeamMemberships.mockResolvedValue([
    { workspaceId: 'ws-maison', ownerClerkUserId: 'user_hana', role: 'member' },
    { workspaceId: 'ws-kids', ownerClerkUserId: 'user_sara', role: 'admin' },
  ]);
});
afterEach(() => restore());

describe('listTeamSites', () => {
  it("lists only the sites of the person's teams, with their role on each", async () => {
    const sites = await listTeamSites('user_nour');
    expect(sites.map((one) => [one.id, one.role])).toEqual([
      ['maison-site', 'member'],
      ['kids-site', 'admin'],
    ]);
    expect(stub.inFilters).toEqual([['workspace_id', ['ws-maison', 'ws-kids']]]);
  });

  it('reads nothing for a person on no team', async () => {
    listTeamMemberships.mockResolvedValue([]);
    expect(await listTeamSites('user_nour')).toEqual([]);
    expect(stub.inFilters).toEqual([]);
  });
});

describe('listMessengerSitesReadOnly', () => {
  it("lists the person's own sites as their owner, then their teams'", async () => {
    expect((await listMessengerSitesReadOnly('user_nour')).map((one) => [one.id, one.role])).toEqual([
      ['own-site', 'owner'],
      ['maison-site', 'member'],
      ['kids-site', 'admin'],
    ]);
  });
});

describe('requireSiteAccess', () => {
  it('lets the owner do anything on their own site', async () => {
    await expect(requireSiteAccess('user_nour', 'own-site', 'store')).resolves.toMatchObject({ id: 'own-site', role: 'owner' });
  });

  it('lets a member answer chats and keep answers up to date on their team site', async () => {
    await expect(requireSiteAccess('user_nour', 'maison-site', 'chats')).resolves.toMatchObject({ role: 'member' });
    await expect(requireSiteAccess('user_nour', 'maison-site', 'answers')).resolves.toMatchObject({ role: 'member' });
  });

  it("refuses a member the site's settings and an admin the store itself", async () => {
    await expect(requireSiteAccess('user_nour', 'maison-site', 'settings')).rejects.toBeInstanceOf(RoleNotAllowedError);
    await expect(requireSiteAccess('user_nour', 'kids-site', 'settings')).resolves.toMatchObject({ role: 'admin' });
    await expect(requireSiteAccess('user_nour', 'kids-site', 'store')).rejects.toBeInstanceOf(RoleNotAllowedError);
  });

  it('refuses a site on no team of the person', async () => {
    listTeamMemberships.mockResolvedValue([]);
    await expect(requireSiteAccess('user_nour', 'maison-site', 'chats')).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe('provisionableShopDomain', () => {
  it("provisions only for an installed shop the person owns, never a team's", () => {
    const shop = (domain: string, status: string, role: string) => ({ domain, status, role });
    expect(
      provisionableShopDomain([
        shop('maison.myshopify.com', 'installed', 'admin'),
        shop('old.myshopify.com', 'uninstalled', 'owner'),
        shop('mine.myshopify.com', 'installed', 'owner'),
      ]),
    ).toBe('mine.myshopify.com');
    expect(provisionableShopDomain([shop('maison.myshopify.com', 'installed', 'member')])).toBeNull();
  });
});
