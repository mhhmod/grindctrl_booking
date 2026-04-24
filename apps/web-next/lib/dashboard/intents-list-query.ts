import { INTENT_ACTION_OPTIONS } from '@/lib/intents';
import type { SearchParams, WidgetIntent } from '@/lib/types';

export const INTENTS_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export const INTENTS_SORT_OPTIONS = ['priority_asc', 'priority_desc', 'label_asc', 'label_desc'] as const;

export type IntentsSortOption = (typeof INTENTS_SORT_OPTIONS)[number];

export type IntentsActionFilter = 'all' | (typeof INTENT_ACTION_OPTIONS)[number];

export type IntentsListQuery = {
  q: string;
  action: IntentsActionFilter;
  sort: IntentsSortOption;
  page: number;
  pageSize: (typeof INTENTS_PAGE_SIZE_OPTIONS)[number];
};

export type ResolvedIntentsList = {
  items: WidgetIntent[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
};

const DEFAULT_INTENTS_QUERY: IntentsListQuery = {
  q: '',
  action: 'all',
  sort: 'priority_asc',
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

function normalizeSort(value: string): IntentsSortOption {
  if (INTENTS_SORT_OPTIONS.includes(value as IntentsSortOption)) {
    return value as IntentsSortOption;
  }
  return DEFAULT_INTENTS_QUERY.sort;
}

function normalizeAction(value: string): IntentsActionFilter {
  if (value === 'all') {
    return 'all';
  }

  if (INTENT_ACTION_OPTIONS.includes(value as (typeof INTENT_ACTION_OPTIONS)[number])) {
    return value as IntentsActionFilter;
  }

  return DEFAULT_INTENTS_QUERY.action;
}

function normalizePageSize(value: number): (typeof INTENTS_PAGE_SIZE_OPTIONS)[number] {
  if (INTENTS_PAGE_SIZE_OPTIONS.includes(value as (typeof INTENTS_PAGE_SIZE_OPTIONS)[number])) {
    return value as (typeof INTENTS_PAGE_SIZE_OPTIONS)[number];
  }
  return DEFAULT_INTENTS_QUERY.pageSize;
}

function sortIntents(intents: WidgetIntent[], sort: IntentsSortOption) {
  return [...intents].sort((a, b) => {
    if (sort === 'label_asc' || sort === 'label_desc') {
      const compare = `${a.label ?? ''}`.toLocaleLowerCase().localeCompare(`${b.label ?? ''}`.toLocaleLowerCase());
      return sort === 'label_asc' ? compare : compare * -1;
    }

    const left = Number(a.sort_order ?? 0);
    const right = Number(b.sort_order ?? 0);
    const compare = left - right;
    return sort === 'priority_asc' ? compare : compare * -1;
  });
}

export function parseIntentsListQuery(params: SearchParams): IntentsListQuery {
  return {
    q: readSearchParam(params, 'q').trim().slice(0, 120),
    action: normalizeAction(readSearchParam(params, 'action')),
    sort: normalizeSort(readSearchParam(params, 'sort')),
    page: parsePositiveInteger(readSearchParam(params, 'page'), DEFAULT_INTENTS_QUERY.page),
    pageSize: normalizePageSize(parsePositiveInteger(readSearchParam(params, 'pageSize'), DEFAULT_INTENTS_QUERY.pageSize)),
  };
}

export function resolveIntentsList(intents: WidgetIntent[], query: IntentsListQuery): ResolvedIntentsList {
  const normalizedQuery = query.q.toLocaleLowerCase();

  const filtered = intents.filter((intent) => {
    const actionType = intent.action_type ?? 'send_message';
    if (query.action !== 'all' && actionType !== query.action) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [intent.label, intent.icon, intent.action_type, intent.message_text, intent.external_url]
      .some((value) => `${value ?? ''}`.toLocaleLowerCase().includes(normalizedQuery));
  });

  const sorted = sortIntents(filtered, query.sort);
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
