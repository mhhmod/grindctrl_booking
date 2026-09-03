import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupportDeskSettings } from './support-desk-settings';

/* "Grant order access" replaced the whole embedded app with
   "accounts.shopify.com refused to connect".

   This panel renders inside the embedded Shopify app, which is an iframe on
   admin.shopify.com. Following the consent href in-frame lands on
   accounts.shopify.com, and Shopify's own account pages refuse to be framed.
   Any navigation from this app to a Shopify-owned domain has to leave the
   iframe — the same defect that broke the theme-editor deep link. */

const ACTIONS = {
  saveDraftSection: vi.fn(async () => ({ ok: true as const })),
};

function renderPanel() {
  return render(
    <SupportDeskSettings
      locale="en"
      siteId="site-1"
      shopDomain="grindctrl.myshopify.com"
      notifications={{ recipients: [], handoffEmail: null, handoffEmailEnabled: false } as never}
      contactCapture={{ enabled: false, askOutsideHours: false } as never}
      attachments={{ enabled: false, triageEnabled: false } as never}
      orderLookup={{ enabled: false } as never}
      actions={ACTIONS as never}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SupportDeskSettings — grant order access', () => {
  it('keeps a real href so the standalone dashboard and middle-click still work', () => {
    renderPanel();

    const link = screen.getByRole('link', { name: 'Grant order access' });
    expect(link).toHaveAttribute(
      'href',
      '/api/shopify/oauth/start?shop=grindctrl.myshopify.com',
    );
  });

  it('navigates the top window out of the embedded app iframe', () => {
    renderPanel();

    const top = { location: { href: 'https://admin.shopify.com/store/grindctrl' } };
    // window.top !== window.self is what "we are embedded" means here.
    vi.stubGlobal('top', top);

    const link = screen.getByRole('link', { name: 'Grant order access' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(event.defaultPrevented).toBe(true);
    expect(top.location.href).toBe(
      `${window.location.origin}/api/shopify/oauth/start?shop=grindctrl.myshopify.com`,
    );
  });

  it('leaves an unframed dashboard navigation alone', () => {
    renderPanel();

    // Not embedded: window.top is window itself, so the plain href must win
    // and nothing should be intercepted.
    vi.stubGlobal('top', window.self);

    const link = screen.getByRole('link', { name: 'Grant order access' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(link, event);

    expect(event.defaultPrevented).toBe(false);
  });
});

/* The panel offered "Grant order access" and then said nothing at all about
   whether access had ever been granted. The only way to find out was to press
   it again and watch what happened. */
describe('SupportDeskSettings — order access state', () => {
  it('says plainly that access has not been approved yet', () => {
    render(
      <SupportDeskSettings
        locale="en"
        siteId="site-1"
        shopDomain="grindctrl.myshopify.com"
        ordersAuthorized={false}
        notifications={{ recipients: [], emailOnHandoff: false } as never}
        contactCapture={{ enabled: false, askOutsideHours: false } as never}
        attachments={{ enabled: false, triageEnabled: false } as never}
        orderLookup={{ enabled: false } as never}
        actions={ACTIONS as never}
      />,
    );

    expect(screen.getByText(/Not approved yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Grant order access' })).toBeInTheDocument();
  });

  it('confirms approval and offers re-approval rather than a fresh grant', () => {
    render(
      <SupportDeskSettings
        locale="en"
        siteId="site-1"
        shopDomain="grindctrl.myshopify.com"
        ordersAuthorized
        notifications={{ recipients: [], emailOnHandoff: false } as never}
        contactCapture={{ enabled: false, askOutsideHours: false } as never}
        attachments={{ enabled: false, triageEnabled: false } as never}
        orderLookup={{ enabled: false } as never}
        actions={ACTIONS as never}
      />,
    );

    expect(screen.getByText('Approved for this store')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Re-approve order access' })).toBeInTheDocument();
  });
});
