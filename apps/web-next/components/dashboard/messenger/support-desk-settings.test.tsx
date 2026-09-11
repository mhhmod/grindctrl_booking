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

const BASE_PROPS = {
  locale: 'en' as const,
  shopDomain: 'grindctrl.myshopify.com',
  notifications: { recipients: [], emailOnHandoff: false },
  contactCapture: { enabled: false, askOutsideHours: false },
  attachments: { enabled: false, triageEnabled: false },
  orderLookup: { enabled: false },
};

function renderPanel(
  overrides: Partial<typeof BASE_PROPS & { ordersAuthorized?: boolean }> = {},
) {
  const props = { ...BASE_PROPS, ...overrides };
  const onNotificationsChange = vi.fn();
  const onContactCaptureChange = vi.fn();
  const onAttachmentsChange = vi.fn();
  const onOrderLookupChange = vi.fn();
  const utils = render(
    <SupportDeskSettings
      {...props}
      onNotificationsChange={onNotificationsChange}
      onContactCaptureChange={onContactCaptureChange}
      onAttachmentsChange={onAttachmentsChange}
      onOrderLookupChange={onOrderLookupChange}
    />,
  );
  return {
    ...utils,
    onNotificationsChange,
    onContactCaptureChange,
    onAttachmentsChange,
    onOrderLookupChange,
  };
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
    renderPanel({ ordersAuthorized: false });

    expect(screen.getByText(/Not approved yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Grant order access' })).toBeInTheDocument();
  });

  it('confirms approval and offers re-approval rather than a fresh grant', () => {
    renderPanel({ ordersAuthorized: true });

    expect(screen.getByText('Approved for this store')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Re-approve order access' })).toBeInTheDocument();
  });
});

/* The support-desk panel is presentational now: the Behaviour tab's single
   form owns state and saving, so this component must render no <form> and
   no save button of its own — edits flow up through onChange props. */
describe('SupportDeskSettings — controlled component', () => {
  it('renders no form and no save button of its own', () => {
    const { container } = renderPanel();

    expect(container.querySelectorAll('form')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });

  it('pushes checkbox edits up through onChange instead of saving itself', () => {
    const { onContactCaptureChange } = renderPanel();

    fireEvent.click(screen.getByText('Ask a shopper where to reply when nobody can answer now'));

    expect(onContactCaptureChange).toHaveBeenCalledWith({ enabled: true, askOutsideHours: false });
  });

  it('keeps the raw recipients text visible while pushing the parsed array up', () => {
    const { onNotificationsChange } = renderPanel({
      notifications: { recipients: [], emailOnHandoff: true },
    });

    const textarea = screen.getByLabelText('Send to these addresses instead (one per line)');
    fireEvent.change(textarea, { target: { value: 'half-typed@\n' } });

    // Raw buffer stays under the cursor; parent gets the parsed array.
    expect(textarea).toHaveValue('half-typed@\n');
    expect(onNotificationsChange).toHaveBeenCalledWith({
      emailOnHandoff: true,
      recipients: ['half-typed@'],
    });
  });
});
