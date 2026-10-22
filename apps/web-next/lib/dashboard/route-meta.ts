import { getDashboardCopy } from '@/lib/dashboard/dashboard-i18n';
import { DEFAULT_SITE_LOCALE, type SiteLocale } from '@/lib/landing/landing-i18n';

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

const DASHBOARD_HOME_PATH = '/dashboard';

const DASHBOARD_ROUTE_DEFINITIONS: DashboardRouteDefinition[] = [
  {
    pathname: '/dashboard',
    title: 'Overview',
    description: 'The try-on business this week, across every merchant store.',
  },
  {
    pathname: '/dashboard/inbox',
    title: 'Inbox',
    description: 'Shopper conversations that need your team.',
  },
  {
    pathname: '/dashboard/try-on',
    title: 'Try-On',
    description: 'Settings, plans, and generation history for every merchant store.',
  },
  {
    pathname: '/dashboard/plan',
    title: 'Plan and looks',
    description: 'Your plan and the try-on looks this cycle.',
  },
  {
    pathname: '/dashboard/store-chat',
    title: 'Store Chat',
    description: 'The chat box on your storefront: appearance, AI, behaviour, installation.',
  },
  {
    pathname: '/dashboard/install',
    title: 'Widget / Embed',
    description: 'Install snippet, verification concept, and widget preview panel.',
  },
  {
    pathname: '/dashboard/settings',
    title: 'Settings',
    description: 'Workspace configuration and account-level controls.',
  },
];

const DASHBOARD_ROUTE_ALIASES: Record<string, string> = {
  '/dashboard/overview': '/dashboard',
  '/dashboard/sites': '/dashboard/install',
  '/dashboard/branding': '/dashboard/install',
  '/dashboard/domains': '/dashboard/install',
  '/dashboard/widget': '/dashboard/install',
};

function toTitleCase(segment: string) {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildBreadcrumbs(
  pathname: string,
  title: string,
  homeLabel: string,
): DashboardBreadcrumbItem[] {
  if (pathname === DASHBOARD_HOME_PATH) {
    return [{ label: homeLabel, href: DASHBOARD_HOME_PATH }];
  }

  return [
    { label: homeLabel, href: DASHBOARD_HOME_PATH },
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

export function getDashboardRouteMeta(
  pathname: string,
  locale: SiteLocale = DEFAULT_SITE_LOCALE,
): DashboardRouteMeta {
  const normalizedPathname = normalizeDashboardPathname(pathname);
  const copy = getDashboardCopy(locale);

  /* Home is /dashboard itself, so only an exact match is home; every other
     route also owns the paths under it. */
  const match = DASHBOARD_ROUTE_DEFINITIONS.find(
    (route) =>
      normalizedPathname === route.pathname ||
      (route.pathname !== DASHBOARD_HOME_PATH && normalizedPathname.startsWith(`${route.pathname}/`)),
  );

  if (match) {
    /* The English route table stays the source of truth for which routes
       exist; the dictionary only supplies wording. A route with no
       translation yet falls back to its English text rather than a blank. */
    const translated = copy.routes[match.pathname];
    const title = translated?.title ?? match.title;

    return {
      pathname: normalizedPathname,
      title,
      description: translated?.description ?? match.description,
      breadcrumbs: buildBreadcrumbs(match.pathname, title, copy.home),
    };
  }

  const fallbackSegment = normalizedPathname.split('/').filter(Boolean).at(-1) ?? 'overview';
  const fallbackTitle = toTitleCase(fallbackSegment);

  return {
    pathname: normalizedPathname,
    title: fallbackTitle,
    description: 'Workspace data for this dashboard section.',
    breadcrumbs: buildBreadcrumbs(normalizedPathname, fallbackTitle, copy.home),
  };
}
