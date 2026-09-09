import { describe, expect, it } from 'vitest';
import { buildShopifyDataRequest, buildShopifyPrivacyAlert } from './shopify-privacy';

const request = {
  webhookId: 'delivery-1', shopDomain: 'demo.myshopify.com', customerEmail: 'customer@example.com',
  customerId: 123, visitors: [],
};

describe('Shopify privacy emails', () => {
  it('clearly reports no customer records and identifies the request', () => {
    const email = buildShopifyDataRequest(request);
    expect(email.subject).toBe('Shopify customer data request — demo.myshopify.com');
    expect(email.text).toContain('No customer records were found for customer@example.com');
    expect(email.text).toContain('delivery-1');
    expect(email.text).toContain('123');
  });

  it('includes complete records and escapes untrusted HTML without truncating the export', () => {
    const content = '<img src=x onerror=alert(1)>\nمرحبا ' + 'x'.repeat(2000);
    const email = buildShopifyDataRequest({ ...request, visitors: [{
      visitor: { id: 'visitor-1', anonymous_id: 'anon-1', user_name: 'Sara', user_email: request.customerEmail },
      conversations: [{
        conversation: { id: 'conversation-1', status: 'closed' },
        messages: [{ role: 'user', content, created_at: '2026-09-09T00:00:00Z' }],
        feedback: [{ rating: 5, comment: 'helpful <script>' }],
      }],
    }] });
    expect(email.text).toContain(JSON.stringify(content));
    expect(email.text).toContain('anon-1');
    expect(email.text).toContain('conversation-1');
    expect(email.text).toContain('helpful <script>');
    expect(email.html).not.toContain('<img');
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;img');
    expect(email.html).toContain('overflow-wrap:anywhere');
  });

  it.each(['disabled', 'failed'] as const)('explains %s requests needing manual handling', (reason) => {
    const email = buildShopifyPrivacyAlert({
      webhookId: request.webhookId, shopDomain: request.shopDomain,
      topic: 'customers/redact', reason, error: '<database unavailable>',
    });
    expect(email.text).toContain('Manual handling is required');
    expect(email.text).toContain('customers/redact');
    expect(email.text).toContain('delivery-1');
    expect(email.text).toContain(reason === 'disabled' ? 'processing is disabled' : 'processing failed');
    expect(email.html).not.toContain('<database unavailable>');
  });

  it('keeps request-controlled newlines out of email subjects', () => {
    const email = buildShopifyDataRequest({ ...request, shopDomain: 'demo.myshopify.com\r\nBcc: stranger@example.com' });
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});
