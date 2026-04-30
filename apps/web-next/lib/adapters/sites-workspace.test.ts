import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/adapters/workspace', () => ({
  getWorkspaceBundle: vi.fn(),
}));
vi.mock('@/lib/adapters/domains', () => ({
  listDomains: vi.fn(),
}));
vi.mock('@/lib/adapters/installVerification', () => ({
  getInstallVerification: vi.fn(),
}));
vi.mock('@/lib/adapters/widgetEvents', async () => {
  const actual = await vi.importActual<typeof import('@/lib/adapters/widgetEvents')>('@/lib/adapters/widgetEvents');
  return {
    ...actual,
    getWidgetEventAnalyticsBundle: vi.fn(),
  };
});

import { getWorkspaceBundle } from '@/lib/adapters/workspace';
import { listDomains } from '@/lib/adapters/domains';
import { getInstallVerification } from '@/lib/adapters/installVerification';
import { getWidgetEventAnalyticsBundle } from '@/lib/adapters/widgetEvents';
import { getSitesWorkspaceBundle } from '@/lib/adapters/sites-workspace';

describe('sites workspace adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns grouped backend state for a selected site', async () => {
    vi.mocked(getWorkspaceBundle).mockResolvedValue({
      workspace: { id: 'workspace_1', name: 'Workspace' },
      role: 'owner',
      sites: [{ id: 'site_1', workspace_id: 'workspace_1', name: 'Main', embed_key: 'gc_key', status: 'active', settings_json: {} }],
    });
    vi.mocked(listDomains).mockResolvedValue([]);
    vi.mocked(getInstallVerification).mockResolvedValue(null);
    vi.mocked(getWidgetEventAnalyticsBundle).mockResolvedValue({ timeseries: [], breakdown: [], funnel: null });

    const result = await getSitesWorkspaceBundle({
      clerkUserId: 'user_1',
      searchParams: Promise.resolve({ site: 'site_1', window: '7d' }),
    });

    expect(result.selectedSiteId).toBe('site_1');
    expect(result.installSnippets?.canonical).toContain('gc_key');
    expect(result.widgetEvents.status).toBe('success');
    expect(listDomains).toHaveBeenCalledWith('user_1', 'site_1');
  });

  it('keeps grouped result shape when verification/events fail', async () => {
    vi.mocked(getWorkspaceBundle).mockResolvedValue({
      workspace: { id: 'workspace_1', name: 'Workspace' },
      role: 'owner',
      sites: [{ id: 'site_1', workspace_id: 'workspace_1', name: 'Main', embed_key: 'gc_key', status: 'active', settings_json: {} }],
    });
    vi.mocked(listDomains).mockResolvedValue([]);
    vi.mocked(getInstallVerification).mockRejectedValue(new Error('verification failed'));
    vi.mocked(getWidgetEventAnalyticsBundle).mockRejectedValue(new Error('events failed'));

    const result = await getSitesWorkspaceBundle({
      clerkUserId: 'user_1',
      searchParams: Promise.resolve({ site: 'site_1', window: '30d' }),
    });

    expect(result.installVerification.status).toBe('error');
    expect(result.widgetEvents.status).toBe('error');
    expect(result.widgetEvents.bundle.timeseries).toEqual([]);
  });
});
