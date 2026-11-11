import 'server-only';
import { buildStoreHealthEmail, type StoreHealthEmailInput } from './store-health';
import { getSmtpFrom, getSmtpTransport } from './transport';

export type HealthDeliveryOutcome = 'sent' | 'retry' | 'unknown';

/** SMTP has no idempotency API. Only errors proving non-delivery are retryable.
 * A disconnect/timeout after DATA may mean the server accepted the message.
 * Its durable claim must survive, even if that costs a missed email. */
export function healthSmtpFailure(error: unknown): HealthDeliveryOutcome {
  const e = error as { code?: string; command?: string; responseCode?: number } | null;
  if (e?.responseCode && e.responseCode >= 400) return 'retry';
  if (e?.command && ['CONN', 'EHLO', 'HELO', 'AUTH', 'MAIL FROM', 'RCPT TO'].includes(e.command)) return 'retry';
  if (e?.code && ['ECONNECTION', 'EDNS', 'EAUTH', 'EENVELOPE'].includes(e.code)) return 'retry';
  return 'unknown';
}

export async function sendStoreHealthEmail(input: StoreHealthEmailInput & { to: string; deliveryId: string }): Promise<HealthDeliveryOutcome> {
  const transport = getSmtpTransport({ connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 });
  const from = getSmtpFrom();
  if (!transport || !from) return 'retry';
  const email = buildStoreHealthEmail(input);
  try {
    const result = await transport.sendMail({ from, to: input.to, ...email, textEncoding: 'base64',
      messageId: `<store-health-${input.deliveryId}@grindctrl.cloud>`,
      headers: { 'X-GrindCTRL-Notification': 'store-health' },
    });
    // A resolved send with an explicit rejection is also definite non-delivery.
    if (result.rejected?.length || result.pending?.length) return 'retry';
    return result.accepted?.length ? 'sent' : 'unknown';
  } catch (error) {
    const outcome = healthSmtpFailure(error);
    console.error('[store-health] email failed', { outcome, code: (error as { code?: string })?.code });
    return outcome;
  } finally { transport.close(); }
}
