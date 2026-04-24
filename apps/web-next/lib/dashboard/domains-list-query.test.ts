import { describe, expect, it } from 'vitest';
import { parseDomainsListQuery, resolveDomainsList } from '@/lib/dashboard/domains-list-query';
import type { WidgetDomain } from '@/lib/types';

const SAMPLE_DOMAINS: WidgetDomain[] = [
  { id: 'domain_1', widget_site_id: 'site_1', domain: 'example.com', verification_status: 'verified' },
  { id: 'domain_2', widget_site_id: 'site_1', domain: 'api.example.com', verification_status: 'pending' },
  { id: 'domain_3', widget_site_id: 'site_1', domain: 'support.grindctrl.com', verification_status: 'failed' },
];

describe('domains list query helpers', () => {
  it('normalizes invalid query params to safe defaults', () => {
    const query = parseDomainsListQuery({
      status: 'invalid',
      sort: 'nope',
      page: '-1',
      pageSize: '999',
    });

    expect(query).toEqual({
      q: '',
      status: 'all',
      sort: 'domain_asc',
      page: 1,
      pageSize: 10,
    });
  });

  it('filters by status and applies pagination bounds', () => {
    const query = parseDomainsListQuery({
      status: 'verified',
      page: '5',
      pageSize: '10',
    });
    const resolved = resolveDomainsList(SAMPLE_DOMAINS, query);

    expect(resolved.totalItems).toBe(1);
    expect(resolved.page).toBe(1);
    expect(resolved.items[0]?.domain).toBe('example.com');
  });

  it('supports text search across domain and status fields', () => {
    const query = parseDomainsListQuery({ q: 'support' });
    const resolved = resolveDomainsList(SAMPLE_DOMAINS, query);

    expect(resolved.totalItems).toBe(1);
    expect(resolved.items[0]?.id).toBe('domain_3');
  });
});
