import type { SearchParams, WidgetLead } from '@/lib/types';

export const LEADS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export const LEADS_SORT_OPTIONS = ['captured_desc', 'captured_asc', 'name_asc', 'name_desc'] as const;

export type LeadsSortOption = (typeof LEADS_SORT_OPTIONS)[number];

export type LeadsListQuery = {
  q: string;
  sort: LeadsSortOption;
  page: number;
  pageSize: (typeof LEADS_PAGE_SIZE_OPTIONS)[number];
};

export type ResolvedLeadsList = {
  items: WidgetLead[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
};

const DEFAULT_LEADS_QUERY: LeadsListQuery = {
  q: '',
  sort: 'captured_desc',
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

function normalizeSort(value: string): LeadsSortOption {
  if (LEADS_SORT_OPTIONS.includes(value as LeadsSortOption)) {
    return value as LeadsSortOption;
  }
  return DEFAULT_LEADS_QUERY.sort;
}

function normalizePageSize(value: number): (typeof LEADS_PAGE_SIZE_OPTIONS)[number] {
  if (LEADS_PAGE_SIZE_OPTIONS.includes(value as (typeof LEADS_PAGE_SIZE_OPTIONS)[number])) {
    return value as (typeof LEADS_PAGE_SIZE_OPTIONS)[number];
  }
  return DEFAULT_LEADS_QUERY.pageSize;
}

function sortLeads(leads: WidgetLead[], sort: LeadsSortOption) {
  return [...leads].sort((a, b) => {
    if (sort === 'name_asc' || sort === 'name_desc') {
      const left = `${a.name ?? a.email ?? ''}`.toLocaleLowerCase();
      const right = `${b.name ?? b.email ?? ''}`.toLocaleLowerCase();
      const compare = left.localeCompare(right);
      return sort === 'name_asc' ? compare : compare * -1;
    }

    const leftTimestamp = a.created_at ? Date.parse(a.created_at) : 0;
    const rightTimestamp = b.created_at ? Date.parse(b.created_at) : 0;
    const compare = leftTimestamp - rightTimestamp;
    return sort === 'captured_asc' ? compare : compare * -1;
  });
}

export function parseLeadsListQuery(params: SearchParams): LeadsListQuery {
  const q = readSearchParam(params, 'q').trim().slice(0, 120);
  const sort = normalizeSort(readSearchParam(params, 'sort'));
  const page = parsePositiveInteger(readSearchParam(params, 'page'), DEFAULT_LEADS_QUERY.page);
  const pageSize = normalizePageSize(parsePositiveInteger(readSearchParam(params, 'pageSize'), DEFAULT_LEADS_QUERY.pageSize));

  return {
    q,
    sort,
    page,
    pageSize,
  };
}

export function resolveLeadsList(leads: WidgetLead[], query: LeadsListQuery): ResolvedLeadsList {
  const normalizedQuery = query.q.trim().toLocaleLowerCase();

  const filtered = normalizedQuery
    ? leads.filter((lead) => [lead.name, lead.email, lead.company, lead.phone, lead.source_domain].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)))
    : leads;

  const sorted = sortLeads(filtered, query.sort);
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
