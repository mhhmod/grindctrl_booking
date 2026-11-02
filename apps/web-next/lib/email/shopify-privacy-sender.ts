import 'server-only';
import { createHash } from 'node:crypto';
import {
  buildShopifyDataRequest, buildShopifyPrivacyAlert,
  type ShopifyDataRequestInput, type ShopifyPrivacyAlertInput,
} from './shopify-privacy';
import { getSmtpFrom, getSmtpTransport } from './transport';

export const PRIVACY_OPERATOR_MAILBOX = 'grindctrlnow@gmail.com';

/** Stable across retries. SMTP cannot atomically acknowledge a database write;
 * this identifier supports mailbox deduplication after an uncertain send. */
export function privacyMessageId(caseIdentity: string, kind: 'receipt' | 'reminder' | 'export'): string {
  return `<privacy-${createHash('sha256').update(`${caseIdentity}:${kind}`).digest('hex')}@grindctrl.com>`;
}

// Both template construction and transport setup can fail. Never reject:
// callers persist an unsuccessful send for manual handling.
async function sendPrivacyEmail(
  messageId: string,
  alert: boolean,
  build: () => { subject: string; html: string; text: string },
): Promise<{ sent: boolean }> {
  try {
    const transport = getSmtpTransport();
    const from = getSmtpFrom();
    if (!transport || !from) {
      console.error('[shopify-privacy] SMTP is not configured; request remains pending');
      return { sent: false };
    }
    const result = await transport.sendMail({
      from, to: PRIVACY_OPERATOR_MAILBOX, messageId, ...build(), textEncoding: 'base64',
      headers: { 'X-GrindCTRL-Notification': alert ? 'shopify-privacy-alert' : 'shopify-data-request' },
    });
    if (result.rejected?.length || !result.accepted?.some((recipient: string | { address: string }) =>
      (typeof recipient === 'string' ? recipient : recipient.address).toLowerCase() === PRIVACY_OPERATOR_MAILBOX)) {
      console.error('[shopify-privacy] operator email was not accepted; request remains pending');
      return { sent: false };
    }
    return { sent: true };
  } catch {
    // The export and SMTP errors may contain customer data; keep them out of logs.
    console.error('[shopify] privacy email failed');
    return { sent: false };
  }
}

export async function sendShopifyDataRequest(
  input: ShopifyDataRequestInput & { messageId: string },
): Promise<{ sent: boolean }> {
  return sendPrivacyEmail(input.messageId, false, () => buildShopifyDataRequest(input));
}

export async function sendShopifyPrivacyAlert(
  input: ShopifyPrivacyAlertInput & { messageId: string },
): Promise<{ sent: boolean }> {
  return sendPrivacyEmail(input.messageId, true, () => buildShopifyPrivacyAlert(input));
}
