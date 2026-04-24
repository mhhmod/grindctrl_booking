import { describe, expect, it } from 'vitest';
import { parseIntentsListQuery, resolveIntentsList } from '@/lib/dashboard/intents-list-query';
import type { WidgetIntent } from '@/lib/types';

const SAMPLE_INTENTS: WidgetIntent[] = [
  { id: 'intent_1', widget_site_id: 'site_1', label: 'Talk to sales', action_type: 'send_message', sort_order: 0 },
  { id: 'intent_2', widget_site_id: 'site_1', label: 'Book demo', action_type: 'external_link', external_url: 'https://example.com/demo', sort_order: 2 },
  { id: 'intent_3', widget_site_id: 'site_1', label: 'Escalate issue', action_type: 'escalate', sort_order: 1 },
];

describe('intents list query helpers', () => {
  it('normalizes invalid query params to safe defaults', () => {
    const query = parseIntentsListQuery({
      action: 'invalid',
      sort: 'nope',
      page: '0',
      pageSize: '999',
    });

    expect(query).toEqual({
      q: '',
      action: 'all',
      sort: 'priority_asc',
      page: 1,
      pageSize: 10,
    });
  });

  it('filters by action and keeps page in valid range', () => {
    const query = parseIntentsListQuery({
      action: 'external_link',
      page: '3',
      pageSize: '10',
    });
    const resolved = resolveIntentsList(SAMPLE_INTENTS, query);

    expect(resolved.totalItems).toBe(1);
    expect(resolved.page).toBe(1);
    expect(resolved.items[0]?.label).toBe('Book demo');
  });

  it('supports query matching across label and URL fields', () => {
    const query = parseIntentsListQuery({ q: 'demo' });
    const resolved = resolveIntentsList(SAMPLE_INTENTS, query);

    expect(resolved.totalItems).toBe(1);
    expect(resolved.items[0]?.id).toBe('intent_2');
  });
});
