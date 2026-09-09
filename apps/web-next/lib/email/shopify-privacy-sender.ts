import 'server-only';
import {
  buildShopifyDataRequest, buildShopifyPrivacyAlert,
  type ShopifyDataRequestInput, type ShopifyPrivacyAlertInput,
} from './shopify-privacy';
import { getSmtpFrom, getSmtpTransport } from './transport';

// Both template construction and transport setup can fail. Never reject:
// callers persist an unsuccessful send for manual handling.
async function sendPrivacyEmail(
  to: string[],
  alert: boolean,
  build: () => { subject: string; html: string; text: string },
): Promise<{ sent: boolean }> {
  try {
    const transport = getSmtpTransport();
    const from = getSmtpFrom();
    if (!transport || !from) return { sent: false };
    const recipients = Array.isArray(to) ? to.filter((address) => address.trim()) : [];
    const bcc = [...new Set([
      ...(alert || recipients.length === 0 ? [from.address] : []), ...recipients,
    ])];
    const result = await transport.sendMail({
      from, to: from.address, bcc, ...build(), textEncoding: 'base64',
      headers: { 'X-GrindCTRL-Notification': alert ? 'shopify-privacy-alert' : 'shopify-data-request' },
    });
    // SMTP can accept the From mailbox while rejecting a merchant in Bcc.
    // Such a partial send has not fulfilled the request.
    if (result.rejected?.length) return { sent: false };
    return { sent: true };
  } catch {
    // The export and SMTP errors may contain customer data; keep them out of logs.
    console.error('[shopify] privacy email failed');
    return { sent: false };
  }
}

export async function sendShopifyDataRequest(
  input: ShopifyDataRequestInput & { to: string[] },
): Promise<{ sent: boolean }> {
  return sendPrivacyEmail(input?.to, false, () => buildShopifyDataRequest(input));
}

export async function sendShopifyPrivacyAlert(
  input: ShopifyPrivacyAlertInput & { to: string[] },
): Promise<{ sent: boolean }> {
  return sendPrivacyEmail(input?.to, true, () => buildShopifyPrivacyAlert(input));
}
