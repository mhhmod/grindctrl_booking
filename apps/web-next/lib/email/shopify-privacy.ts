export interface ShopifyCustomerRecords {
  visitor: Record<string, unknown>;
  conversations: Array<{
    conversation: Record<string, unknown>;
    messages: Array<{ role: string; content: string; created_at: string }>;
    feedback: Array<{ rating: number; comment: string | null }>;
  }>;
}

export interface ShopifyDataRequestInput {
  webhookId: string;
  shopDomain: string;
  customerEmail: string;
  customerId: string | number | null;
  visitors: ShopifyCustomerRecords[];
}

export interface ShopifyPrivacyAlertInput {
  webhookId: string;
  shopDomain: string;
  topic: string;
  reason: 'disabled' | 'failed';
  error?: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function buildEmail(subject: string, text: string): { subject: string; html: string; text: string } {
  return {
    subject: subject.replace(/[\r\n]/g, ' '),
    text,
    html: `<!doctype html><html><body><pre dir="auto" style="font-family:system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(text)}</pre></body></html>`,
  };
}

export function buildShopifyDataRequest(input: ShopifyDataRequestInput): { subject: string; html: string; text: string } {
  // JSON preserves the entire export, including newlines, without letting
  // customer-authored content masquerade as email instructions.
  return buildEmail(`Shopify customer data request — ${input.shopDomain}`, [
    'Shopify customer data request',
    `Shop: ${input.shopDomain}`,
    `Webhook ID: ${input.webhookId}`,
    `Customer email: ${input.customerEmail}`,
    `Customer ID: ${input.customerId ?? 'not supplied'}`,
    '',
    input.visitors.length
      ? `Customer records found: ${input.visitors.length} visitor(s).\n\n${JSON.stringify(input.visitors, null, 2)}`
      : `No customer records were found for ${input.customerEmail}.`,
    '',
    'Provided to the merchant contact for fulfillment of this privacy request.',
  ].join('\n'));
}

export function buildShopifyPrivacyAlert(input: ShopifyPrivacyAlertInput): { subject: string; html: string; text: string } {
  return buildEmail(`Shopify privacy request — manual handling required — ${input.shopDomain}`, [
    input.reason === 'disabled' ? 'Shopify privacy processing is disabled.' : 'Shopify privacy processing failed.',
    'Manual handling is required. The request is durably recorded in shopify_privacy_requests.',
    `Shop: ${input.shopDomain}`,
    `Topic: ${input.topic}`,
    `Webhook ID: ${input.webhookId}`,
    ...(input.error ? [`Error: ${input.error}`] : []),
    'Redeliveries are deduplicated and do not retry processing. Review the recorded request manually.',
  ].join('\n'));
}
