export type DashboardBreadcrumbItem = {
  label: string;
  href?: string;
};

export type DashboardRouteMeta = {
  pathname: string;
  title: string;
  description: string;
  breadcrumbs: DashboardBreadcrumbItem[];
};

type DashboardRouteDefinition = {
  pathname: string;
  title: string;
  description: string;
};

const DASHBOARD_HOME_PATH = '/dashboard/overview';

const DASHBOARD_ROUTE_DEFINITIONS: DashboardRouteDefinition[] = [
  {
    pathname: '/dashboard/overview',
    title: 'Overview',
    description: 'Workspace health, site metrics, and operational summary.',
  },
  {
    pathname: '/dashboard/inbox',
    title: 'Inbox',
    description: 'Triaged conversation queue with ownership, status filters, and operator detail view.',
  },
  {
    pathname: '/dashboard/leads',
    title: 'Leads',
    description: 'Review and manage leads captured through AI interactions.',
  },
  {
    pathname: '/dashboard/sites',
    title: 'Sites',
    description: 'Manage install, branding, and domain controls for each deployed widget site.',
  },
  {
    pathname: '/dashboard/routing',
    title: 'Routing',
    description: 'Manage AI routing intents and fallback behavior for widget conversations.',
  },
  {
    pathname: '/dashboard/workflows',
    title: 'Workflows',
    description: 'Build and manage AI automation workflows across your operations.',
  },
  {
    pathname: '/dashboard/integrations',
    title: 'Integrations',
    description: 'Connect CRMs, Google Workspace, cloud systems, and third-party services.',
  },
  {
    pathname: '/dashboard/settings',
    title: 'Settings',
    description: 'Workspace configuration, team members, and API access.',
  },
];

const DASHBOARD_ROUTE_ALIASES: Record<string, string> = {
  '/dashboard/conversations': '/dashboard/inbox',
  '/dashboard/install': '/dashboard/sites',
  '/dashboard/branding': '/dashboard/sites',
  '/dashboard/domains': '/dashboard/sites',
  '/dashboard/intents': '/dashboard/routing',
};

function toTitleCase(segment: string) {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildBreadcrumbs(pathname: string, title: string): DashboardBreadcrumbItem[] {
  if (pathname === DASHBOARD_HOME_PATH) {
    return [{ label: 'Dashboard', href: DASHBOARD_HOME_PATH }];
  }

  return [
    { label: 'Dashboard', href: DASHBOARD_HOME_PATH },
    { label: title },
  ];
}

export function normalizeDashboardPathname(pathname: string) {
  if (!pathname || pathname === '/dashboard') {
    return DASHBOARD_HOME_PATH;
  }

  const withoutTrailingSlash = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (DASHBOARD_ROUTE_ALIASES[withoutTrailingSlash]) {
    return DASHBOARD_ROUTE_ALIASES[withoutTrailingSlash];
  }

  return withoutTrailingSlash;
}

export function getDashboardRouteMeta(pathname: string): DashboardRouteMeta {
  const normalizedPathname = normalizeDashboardPathname(pathname);

  const match = DASHBOARD_ROUTE_DEFINITIONS.find((route) => normalizedPathname === route.pathname || normalizedPathname.startsWith(`${route.pathname}/`));

  if (match) {
    return {
      pathname: normalizedPathname,
      title: match.title,
      description: match.description,
      breadcrumbs: buildBreadcrumbs(match.pathname, match.title),
    };
  }

  const fallbackSegment = normalizedPathname.split('/').filter(Boolean).at(-1) ?? 'overview';
  const fallbackTitle = toTitleCase(fallbackSegment);

  return {
    pathname: normalizedPathname,
    title: fallbackTitle,
    description: 'Workspace data for this dashboard section.',
    breadcrumbs: buildBreadcrumbs(normalizedPathname, fallbackTitle),
  };
}
