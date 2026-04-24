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
    description: 'Real workspace and site data, without fake dashboard analytics.',
  },
  {
    pathname: '/dashboard/install',
    title: 'Install Widget',
    description: 'Use the canonical GRINDCTRL install contract and the selected site embed key.',
  },
  {
    pathname: '/dashboard/branding',
    title: 'Branding',
    description: 'Inspect the active branding subset stored inside settings_json.',
  },
  {
    pathname: '/dashboard/intents',
    title: 'Intents',
    description: 'Review current widget intents from the existing dashboard RPC contract.',
  },
  {
    pathname: '/dashboard/domains',
    title: 'Domains',
    description: 'Review allowed domains for the selected widget site.',
  },
  {
    pathname: '/dashboard/leads',
    title: 'Leads',
    description: 'Review captured leads from the current backend-controlled submission flow.',
  },
];

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

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
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
