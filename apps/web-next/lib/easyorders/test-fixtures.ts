import type { EasyOrdersConnection } from './types';
export const SITE = '123e4567-e89b-12d3-a456-426614174000';
export const USER = 'user_owner';
export const TOKEN = 'a'.repeat(64);
export const connection = (overrides: Partial<EasyOrdersConnection> = {}): EasyOrdersConnection => ({
  widget_site_id: SITE, store_id: 'store-1', store_name: null, api_key: { ciphertext: '', iv: '', tag: '' },
  webhook_token: TOKEN, webhook_secret: null, callback_origin: 'https://grindctrl.cloud', status: 'active',
  connected_at: null, last_webhook_at: null, last_error: null, order_cache_version: 0, products_synced_at: null,
  ...overrides,
});
export const order = { id: 'eo-1', short_id: 1027, status: 'in_delivery', phone: '+20 101 234 5678',
  email: 'Mona@example.com', created_at: '2026-11-01T12:00:00Z', total_cost: '300.00',
  full_name: 'Private Name', address: 'Private address', government: 'Cairo',
  cart_items: [{ name: 'Shirt', quantity: 2 }] };
