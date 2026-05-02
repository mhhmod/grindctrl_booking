export type DashboardPermissionKey =
  | 'canViewOverview'
  | 'canViewAgents'
  | 'canViewConversations'
  | 'canViewMessages'
  | 'canViewLeads'
  | 'canViewCrm'
  | 'canViewWorkflows'
  | 'canViewInstall'
  | 'canViewIntegrations'
  | 'canViewAnalytics'
  | 'canViewSettings'
  | 'canViewImplementation';

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
    canViewAgents: true,
    canViewConversations: true,
    canViewMessages: true,
    canViewLeads: true,
    canViewCrm: true,
    canViewWorkflows: true,
    canViewInstall: true,
    canViewIntegrations: true,
    canViewAnalytics: true,
    canViewSettings: true,
    canViewImplementation: true,
  };
}

export function resolveDashboardPermissions(context: DashboardPolicyContext = {}): DashboardPermissionSet {
  const role = normalizeDashboardWorkspaceRole(context.role);

  if (!role) {
    return getDefaultDashboardPermissions();
  }

  return getDefaultDashboardPermissions();
}
