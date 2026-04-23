import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/adapters/domains', async () => {
  const actual = await vi.importActual<typeof import('@/lib/adapters/domains')>('@/lib/adapters/domains');
  return {
    ...actual,
    addDomain: vi.fn(),
    listDomains: vi.fn(),
    removeDomain: vi.fn(),
    updateDomainStatus: vi.fn(),
  };
});

import { addDomainAction, removeDomainAction, updateDomainStatusAction } from '@/app/dashboard/domains/actions';
import { addDomain, listDomains, removeDomain, updateDomainStatus } from '@/lib/adapters/domains';

describe('domain actions', () => {
  it('adds a domain via the real adapter path and returns refreshed domains', async () => {
    vi.mocked(addDomain).mockResolvedValue({
      id: 'domain_1',
      widget_site_id: 'site_1',
      domain: 'example.com',
      verification_status: 'pending',
    });
    vi.mocked(listDomains).mockResolvedValue([
      {
        id: 'domain_1',
        widget_site_id: 'site_1',
        domain: 'example.com',
        verification_status: 'pending',
      },
    ]);

    const formData = new FormData();
    formData.set('domain', 'Example.com');

    const result = await addDomainAction({ clerkUserId: 'user_123', siteId: 'site_1' }, formData);

    expect(addDomain).toHaveBeenCalledWith('user_123', 'site_1', 'example.com');
    expect(listDomains).toHaveBeenCalledWith('user_123', 'site_1');
    expect(result.domains).toHaveLength(1);
    expect(result.messageType).toBe('success');
  });

  it('updates status and removes domains through existing adapters', async () => {
    vi.mocked(updateDomainStatus).mockResolvedValue({
      id: 'domain_1',
      widget_site_id: 'site_1',
      domain: 'example.com',
      verification_status: 'verified',
    });
    vi.mocked(removeDomain).mockResolvedValue(true);
    vi.mocked(listDomains)
      .mockResolvedValueOnce([
        {
          id: 'domain_1',
          widget_site_id: 'site_1',
          domain: 'example.com',
          verification_status: 'verified',
        },
      ])
      .mockResolvedValueOnce([]);

    const updateFormData = new FormData();
    updateFormData.set('domainId', 'domain_1');
    updateFormData.set('status', 'verified');

    const updateResult = await updateDomainStatusAction({ clerkUserId: 'user_123', siteId: 'site_1' }, updateFormData);

    expect(updateDomainStatus).toHaveBeenCalledWith('user_123', 'domain_1', 'verified');
    expect(updateResult.domains[0]?.verification_status).toBe('verified');

    const removeFormData = new FormData();
    removeFormData.set('domainId', 'domain_1');

    const removeResult = await removeDomainAction({ clerkUserId: 'user_123', siteId: 'site_1' }, removeFormData);

    expect(removeDomain).toHaveBeenCalledWith('user_123', 'domain_1');
    expect(removeResult.domains).toEqual([]);
  });
});
