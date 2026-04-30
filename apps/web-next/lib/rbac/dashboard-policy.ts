export type DashboardPermissionKey =
  | 'canViewOverview'
  | 'canViewInstall'
  | 'canViewBranding'
  | 'canViewIntents'
  | 'canViewDomains'
  | 'canViewLeads'
  | 'canViewConversations'
  | 'canViewWorkflows'
  | 'canViewIntegrations'
  | 'canViewSettings';

export type DashboardPermissionSet = Record<DashboardPermissionKey, boolean>;

export type DashboardWorkspaceRole = 'owner' | 'admin' | 'member';

type DashboardPolicyContext = {
  role?: string | null;
};

const DASHBOARD_WORKSPACE_ROLES: DashboardWorkspaceRole[] = ['owner', 'admin', 'member'];

export function normalizeDashboardWorkspaceRole(role?: string | null): DashboardWorkspaceRole | null {
  if (!role) {
    return null;
  }

  if (DASHBOARD_WORKSPACE_ROLES.includes(role as DashboardWorkspaceRole)) {
    return role as DashboardWorkspaceRole;
  }

  return null;
}

export function getDefaultDashboardPermissions(): DashboardPermissionSet {
  return {
    canViewOverview: true,
    canViewInstall: true,
    canViewBranding: true,
    canViewIntents: true,
    canViewDomains: true,
    canViewLeads: true,
    canViewConversations: true,
    canViewWorkflows: true,
    canViewIntegrations: true,
    canViewSettings: true,
  };
}

export function resolveDashboardPermissions(context: DashboardPolicyContext = {}): DashboardPermissionSet {
  const role = normalizeDashboardWorkspaceRole(context.role);

  if (!role) {
    return getDefaultDashboardPermissions();
  }

  return getDefaultDashboardPermissions();
}
