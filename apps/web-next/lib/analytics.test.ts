import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  has_opted_in_capturing: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthog }));

import { trackClick } from '@/lib/analytics';

describe('trackClick', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fails closed until the visitor opts in to analytics', () => {
    posthog.has_opted_in_capturing.mockReturnValue(false);
    trackClick('cta_clicked', { cta: 'try_on', section: 'hero' });
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('maps legacy call sites into the namespaced taxonomy after opt-in', () => {
    posthog.has_opted_in_capturing.mockReturnValue(true);
    trackClick('plan_cta_clicked', { plan: 'growth' });

    expect(posthog.capture).toHaveBeenCalledWith(
      'storefront.cta_clicked',
      expect.objectContaining({
        cta: 'choose_plan',
        placement: 'pricing_plan',
        planKey: 'growth',
        consent_state: 'granted',
        source: 'marketing_site',
      }),
    );
  });
});
