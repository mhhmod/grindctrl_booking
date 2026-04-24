import { DOMAIN_STATUS_OPTIONS } from '@/lib/domains';
import type { SearchParams, WidgetDomain } from '@/lib/types';

export const DOMAINS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export const DOMAINS_SORT_OPTIONS = ['domain_asc', 'domain_desc', 'status_asc', 'status_desc'] as const;

export type DomainsSortOption = (typeof DOMAINS_SORT_OPTIONS)[number];

export type DomainsStatusFilter = 'all' | (typeof DOMAIN_STATUS_OPTIONS)[number];

export type DomainsListQuery = {
  q: string;
  status: DomainsStatusFilter;
  sort: DomainsSortOption;
  page: number;
  pageSize: (typeof DOMAINS_PAGE_SIZE_OPTIONS)[number];
};

export type ResolvedDomainsList = {
  items: WidgetDomain[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
};

const DEFAULT_DOMAINS_QUERY: DomainsListQuery = {
  q: '',
  status: 'all',
  sort: 'domain_asc',
  page: 1,
  pageSize: 10,
};

function readSearchParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return typeof value === 'string' ? value : '';
}

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function normalizeSort(value: string): DomainsSortOption {
  if (DOMAINS_SORT_OPTIONS.includes(value as DomainsSortOption)) {
    return value as DomainsSortOption;
  }
  return DEFAULT_DOMAINS_QUERY.sort;
}

function normalizeStatus(value: string): DomainsStatusFilter {
  if (value === 'all') {
    return 'all';
  }

  if (DOMAIN_STATUS_OPTIONS.includes(value as (typeof DOMAIN_STATUS_OPTIONS)[number])) {
    return value as DomainsStatusFilter;
  }

  return DEFAULT_DOMAINS_QUERY.status;
}

function normalizePageSize(value: number): (typeof DOMAINS_PAGE_SIZE_OPTIONS)[number] {
  if (DOMAINS_PAGE_SIZE_OPTIONS.includes(value as (typeof DOMAINS_PAGE_SIZE_OPTIONS)[number])) {
    return value as (typeof DOMAINS_PAGE_SIZE_OPTIONS)[number];
  }
  return DEFAULT_DOMAINS_QUERY.pageSize;
}

function sortDomains(domains: WidgetDomain[], sort: DomainsSortOption) {
  return [...domains].sort((a, b) => {
    if (sort === 'status_asc' || sort === 'status_desc') {
      const compare = `${a.verification_status ?? ''}`.localeCompare(`${b.verification_status ?? ''}`);
      return sort === 'status_asc' ? compare : compare * -1;
    }

    const compare = `${a.domain ?? ''}`.localeCompare(`${b.domain ?? ''}`);
    return sort === 'domain_asc' ? compare : compare * -1;
  });
}

export function parseDomainsListQuery(params: SearchParams): DomainsListQuery {
  return {
    q: readSearchParam(params, 'q').trim().slice(0, 120),
    status: normalizeStatus(readSearchParam(params, 'status')),
    sort: normalizeSort(readSearchParam(params, 'sort')),
    page: parsePositiveInteger(readSearchParam(params, 'page'), DEFAULT_DOMAINS_QUERY.page),
    pageSize: normalizePageSize(parsePositiveInteger(readSearchParam(params, 'pageSize'), DEFAULT_DOMAINS_QUERY.pageSize)),
  };
}

export function resolveDomainsList(domains: WidgetDomain[], query: DomainsListQuery): ResolvedDomainsList {
  const normalizedQuery = query.q.toLocaleLowerCase();

  const filtered = domains.filter((domain) => {
    if (query.status !== 'all' && domain.verification_status !== query.status) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [domain.domain, domain.verification_status].some((value) => `${value ?? ''}`.toLocaleLowerCase().includes(normalizedQuery));
  });

  const sorted = sortDomains(filtered, query.sort);
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * query.pageSize;
  const items = sorted.slice(offset, offset + query.pageSize);

  return {
    items,
    totalItems,
    page,
    pageSize: query.pageSize,
    totalPages,
    startIndex: totalItems === 0 ? 0 : offset + 1,
    endIndex: totalItems === 0 ? 0 : offset + items.length,
  };
}
