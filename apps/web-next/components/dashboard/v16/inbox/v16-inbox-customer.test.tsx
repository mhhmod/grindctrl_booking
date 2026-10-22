import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMantine as render } from '@/components/mantine/test-utils';
import type { InboxCustomerView } from '@/lib/dashboard/inbox-customer-model';
import { V16InboxCustomer } from './v16-inbox-customer';

const VIEW: InboxCustomerView = {
  title: 'About Salma Ahmed',
  name: 'Salma Ahmed',
  email: 'salma@example.com',
  lines: ['Signed in to the store', 'From the Layla page'],
  customerUrl: 'https://admin.shopify.com/store/maison/customers/7',
  order: {
    title: 'Order #1042',
    stage: 'Out for delivery with Bosta',
    tone: 'attention',
    total: 'EGP 4,700, cash on delivery',
    items: ['Layla Embroidered Abaya'],
    trackingUrl: 'https://bosta.co/track/1',
    shopifyUrl: 'https://admin.shopify.com/store/maison/orders?query=%231042',
  },
  cart: { items: [{ title: 'Zahra Occasion Abaya, M', price: 'EGP 3,900' }], total: 'Total EGP 3,900' },
  past: [{ id: 'c0', date: '21 October', status: 'Resolved', preview: 'Can I exchange the Riyadh abaya?' }],
  empty: false,
};

describe('V16InboxCustomer', () => {
  it('reads the open conversation’s shopper and shows what is known, as the board does', async () => {
    const fetchCustomer = vi.fn(async () => ({ ok: true as const, view: VIEW }));
    render(<V16InboxCustomer locale="en" siteId="s1" conversationId="c1" fetchCustomer={fetchCustomer} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading what we know…');
    expect(await screen.findByRole('heading', { name: 'Salma Ahmed' })).toBeInTheDocument();
    expect(fetchCustomer).toHaveBeenCalledWith('s1', 'c1');
    expect(screen.getByText('Signed in to the store')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the customer in Shopify/ })).toHaveAttribute('href', VIEW.customerUrl);

    const order = screen.getByRole('region', { name: 'Order #1042' });
    expect(order).toHaveTextContent('Out for delivery with Bosta');
    expect(order).toHaveTextContent('EGP 4,700, cash on delivery');
    expect(within(order).getByRole('link', { name: /Open in Shopify/ })).toHaveAttribute('href', VIEW.order!.shopifyUrl);
    expect(within(order).getByRole('link', { name: /Track the parcel/ })).toHaveAttribute('target', '_blank');

    expect(screen.getByRole('region', { name: 'In the cart' })).toHaveTextContent('Zahra Occasion Abaya, MEGP 3,900');
    expect(screen.getByRole('region', { name: 'Past conversations' })).toHaveTextContent('Can I exchange the Riyadh abaya?Resolved · 21 October');
  });

  it('leaves out what is not known, and says when there is nothing earlier', async () => {
    const view = { ...VIEW, customerUrl: null, order: null, cart: null, past: [], lines: [] };
    render(<V16InboxCustomer locale="en" siteId="s1" conversationId="c1" fetchCustomer={async () => ({ ok: true, view })} />);
    expect(await screen.findByText('This is the first conversation.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Order/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'In the cart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says when the details could not load, in Arabic too', async () => {
    render(<V16InboxCustomer locale="ar" siteId="s1" conversationId="c1" fetchCustomer={async () => ({ ok: false })} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('تعذّر تحميل تفاصيل هذا المتسوق'));
  });
});
