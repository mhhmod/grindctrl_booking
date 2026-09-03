import { describe, expect, it, vi } from 'vitest';

// vi.mock is hoisted above plain const declarations; vi.hoisted is not.
const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import DashboardInstallPage from '@/app/dashboard/install/page';

/* This page used to render a mock install centre — a placeholder site key and
   a script URL that 404s in production — and the Shopify OAuth callback
   dropped every merchant on it. Granting order access showed them setup
   instructions for a widget that does not exist, and never said whether the
   grant had worked. */

describe('DashboardInstallPage', () => {
  it('sends the merchant to the real installation surface', () => {
    DashboardInstallPage();
    expect(mocks.redirect).toHaveBeenCalledWith('/dashboard/messenger?tab=installation');
  });
});
