/* Who may do what in the dashboard (v16 phase zero item 12).

   A person's role belongs to a store: its owner, or the role the owner's
   workspace lists them with (workspace_members: owner, admin or member).
   The Team board's rule: owners see everything, including billing; admins
   manage settings; members answer chats and keep answers up to date.

   This module is pure, so the rule is tested on its own. The role always
   comes from the database on the server (lib/rbac/store-role.ts and the
   store checks that use it), never from the client. */

export type DashboardWorkspaceRole = 'owner' | 'admin' | 'member';

/** What a role may do. Each server action names the one it needs. */
export type DashboardCapability =
  /** Plan, the looks meter, plan changes and top-ups. */
  | 'billing'
  /** Set up on Try-On and Store Chat, going live and preview links. */
  | 'settings'
  /** Inviting people and changing their roles. */
  | 'team'
  /** Disconnecting a store from the account. */
  | 'store'
  /** Answering, taking over, assigning and closing chats. */
  | 'chats'
  /** What Store Chat knows and the saved replies. */
  | 'answers';

const ROLE_CAPABILITIES: Record<DashboardWorkspaceRole, readonly DashboardCapability[]> = {
  owner: ['billing', 'settings', 'team', 'store', 'chats', 'answers'],
  admin: ['settings', 'team', 'chats', 'answers'],
  member: ['chats', 'answers'],
};

const ROLE_RANK: Record<DashboardWorkspaceRole, number> = { owner: 3, admin: 2, member: 1 };

const DASHBOARD_WORKSPACE_ROLES = Object.keys(ROLE_RANK) as DashboardWorkspaceRole[];

export function normalizeDashboardWorkspaceRole(role?: string | null): DashboardWorkspaceRole | null {
  if (!role) {
    return null;
  }

  if (DASHBOARD_WORKSPACE_ROLES.includes(role as DashboardWorkspaceRole)) {
    return role as DashboardWorkspaceRole;
  }

  return null;
}

/** An unknown or missing role may do nothing. */
export function roleCan(role: string | null | undefined, capability: DashboardCapability): boolean {
  const known = normalizeDashboardWorkspaceRole(role);
  return known ? ROLE_CAPABILITIES[known].includes(capability) : false;
}

/** The strongest of several roles, for a person listed more than once. */
export function strongestRole(roles: Iterable<string | null | undefined>): DashboardWorkspaceRole | null {
  let strongest: DashboardWorkspaceRole | null = null;
  for (const role of roles) {
    const known = normalizeDashboardWorkspaceRole(role);
    if (known && (!strongest || ROLE_RANK[known] > ROLE_RANK[strongest])) strongest = known;
  }
  return strongest;
}

/** A signed-in person asked for something their role on the store does not allow. */
export class RoleNotAllowedError extends Error {
  constructor(readonly capability: DashboardCapability) {
    super('You do not have permission to perform this action.');
    this.name = 'RoleNotAllowedError';
  }
}

export function requireRole(role: string | null | undefined, capability: DashboardCapability): void {
  if (!roleCan(role, capability)) throw new RoleNotAllowedError(capability);
}

/** Which dashboard pages a role sees in the nav. Every page also checks on
 *  the server; hiding a link is never the protection. */
export type DashboardPermissionKey =
  | 'canViewToday'
  | 'canViewTryOn'
  | 'canViewStoreChat'
  | 'canViewPlan'
  | 'canViewSettings';

export type DashboardPermissionSet = Record<DashboardPermissionKey, boolean>;

type DashboardPolicyContext = {
  role?: string | null;
};

export function resolveDashboardPermissions(context: DashboardPolicyContext = {}): DashboardPermissionSet {
  const role = normalizeDashboardWorkspaceRole(context.role);
  return {
    canViewToday: role !== null,
    canViewTryOn: role !== null,
    canViewStoreChat: role !== null,
    canViewPlan: roleCan(role, 'billing'),
    canViewSettings: roleCan(role, 'settings'),
  };
}
