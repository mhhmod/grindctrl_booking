import { describe, expect, it } from 'vitest';
import { parseLeadsListQuery, resolveLeadsList } from '@/lib/dashboard/leads-list-query';
import type { WidgetLead } from '@/lib/types';

const SAMPLE_LEADS: WidgetLead[] = [
  {
    id: 'lead_1',
    workspace_id: 'workspace_1',
    widget_site_id: 'site_1',
    name: 'Charlie',
    email: 'charlie@example.com',
    company: 'Acme',
    phone: '+1-111-1111',
    source_domain: 'acme.com',
    created_at: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'lead_2',
    workspace_id: 'workspace_1',
    widget_site_id: 'site_1',
    name: 'Ada',
    email: 'ada@example.com',
    company: 'Analytical Engines',
    phone: '+1-222-2222',
    source_domain: 'example.com',
    created_at: '2026-03-10T10:00:00.000Z',
  },
  {
    id: 'lead_3',
    workspace_id: 'workspace_1',
    widget_site_id: 'site_1',
    name: 'Beatrice',
    email: 'bea@example.com',
    company: 'Beta',
    phone: '+1-333-3333',
    source_domain: 'beta.io',
    created_at: '2026-02-10T10:00:00.000Z',
  },
];

describe('leads list query helpers', () => {
  it('normalizes invalid search params to safe defaults', () => {
    const query = parseLeadsListQuery({
      sort: 'unknown',
      page: '0',
      pageSize: '999',
    });

    expect(query).toEqual({
      q: '',
      sort: 'captured_desc',
      page: 1,
      pageSize: 10,
    });
  });

  it('filters, sorts, and paginates with stable page bounds', () => {
    const query = parseLeadsListQuery({
      q: 'analytical',
      sort: 'name_asc',
      page: '2',
      pageSize: '10',
    });

    const resolved = resolveLeadsList(SAMPLE_LEADS, query);

    expect(resolved.totalItems).toBe(1);
    expect(resolved.totalPages).toBe(1);
    expect(resolved.page).toBe(1);
    expect(resolved.items[0]?.name).toBe('Ada');
    expect(resolved.startIndex).toBe(1);
    expect(resolved.endIndex).toBe(1);
  });

  it('uses captured date sorting by default (newest first)', () => {
    const query = parseLeadsListQuery({});
    const resolved = resolveLeadsList(SAMPLE_LEADS, query);

    expect(resolved.items[0]?.id).toBe('lead_2');
  });
});
