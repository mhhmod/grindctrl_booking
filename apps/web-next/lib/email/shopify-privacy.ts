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
  reason: 'receipt' | 'reminder';
  receivedAt: string;
  caseId: string;
  caseSource: 'installation' | 'legacy';
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
  return buildEmail(`Shopify customer data request: ${input.shopDomain}`, [
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
    'Provided to Grind CTRL, the privacy operator. Forward this export securely to the requesting merchant.',
    'This email is not proof of merchant delivery. Record delivery evidence through the restricted operator RPC within 30 days of receipt.',
  ].join('\n'));
}

export function buildShopifyPrivacyAlert(input: ShopifyPrivacyAlertInput): { subject: string; html: string; text: string } {
  const due = new Date(Date.parse(input.receivedAt) + 30 * 86_400_000).toISOString();
  return buildEmail(`Shopify privacy ${input.reason === 'reminder' ? '21-day reminder' : 'request received'}: ${input.shopDomain}`, [
    input.reason === 'reminder' ? 'This privacy request is at least 21 days old and is not complete.' : 'A Shopify privacy request has been durably recorded.',
    'Privacy operator: Grind CTRL. Complete this request within 30 days of receipt.',
    `Case: ${input.caseSource}/${input.caseId}`,
    `Received: ${input.receivedAt}`,
    `Deadline: ${due}`,
    `Shop: ${input.shopDomain}`,
    `Topic: ${input.topic}`,
    `Webhook ID: ${input.webhookId}`,
    'Review the case status and completion evidence. Verified single-owner redactions run automatically; ambiguous ownership, retention holds and legacy cases require manual casework.',
    'Customer exports are emailed separately to this operator mailbox and remain pending until merchant delivery is recorded through the restricted operator RPC.',
    'The scheduled worker retries pending work. Never interpret this receipt or reminder as completion.',
  ].join('\n'));
}
