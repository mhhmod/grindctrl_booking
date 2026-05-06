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
    description: 'Trial workspace home, saved preview handoff, and next best actions.',
  },
  {
    pathname: '/dashboard/agents',
    title: 'AI Agents',
    description: 'Preview and plan AI agents across website, social, voice, file, and CRM channels.',
  },
  {
    pathname: '/dashboard/conversations',
    title: 'Conversations',
    description: 'Unified inbox preview for website and social channel conversations.',
  },
  {
    pathname: '/dashboard/messages',
    title: 'Messages',
    description: 'Message-level preview with AI suggestions and handoff readiness.',
  },
  {
    pathname: '/dashboard/leads',
    title: 'Leads',
    description: 'Preview lead qualification output from conversations, voice, forms, and files.',
  },
  {
    pathname: '/dashboard/crm',
    title: 'CRM',
    description: 'Pipeline preview from captured lead to implementation and conversion.',
  },
  {
    pathname: '/dashboard/workflows',
    title: 'Workflows',
    description: 'Workflow catalog and latest trial preview history.',
  },
  {
    pathname: '/dashboard/try-on',
    title: 'Try-On Agent',
    description: 'Mock-first management surface for product try-on previews and lead capture flow.',
  },
  {
    pathname: '/dashboard/install',
    title: 'Widget / Embed',
    description: 'Install snippet, verification concept, and widget preview panel.',
  },
  {
    pathname: '/dashboard/integrations',
    title: 'Integrations',
    description: 'Connection catalog across AI, social, CRM, support, ops, data, and automation.',
  },
  {
    pathname: '/dashboard/analytics',
    title: 'Analytics',
    description: 'Preview trial funnel, operations metrics, and channel breakdown.',
  },
  {
    pathname: '/dashboard/settings',
    title: 'Settings',
    description: 'Workspace configuration and account-level controls.',
  },
  {
    pathname: '/dashboard/implementation',
    title: 'Implementation',
    description: 'Prepare implementation request form for real tool connections.',
  },
];

const DASHBOARD_ROUTE_ALIASES: Record<string, string> = {
  '/dashboard/inbox': '/dashboard/conversations',
  '/dashboard/sites': '/dashboard/install',
  '/dashboard/branding': '/dashboard/install',
  '/dashboard/domains': '/dashboard/install',
  '/dashboard/routing': '/dashboard/agents',
  '/dashboard/intents': '/dashboard/agents',
  '/dashboard/widget': '/dashboard/install',
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
