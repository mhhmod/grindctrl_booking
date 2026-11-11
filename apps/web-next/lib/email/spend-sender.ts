import 'server-only';
import { buildSpendEmail, type SpendEmailInput } from './spend';
import { getSmtpFrom, getSmtpTransport } from './transport';
import { healthSmtpFailure, type HealthDeliveryOutcome } from './store-health-sender';

export async function sendSpendEmail(input: SpendEmailInput, to: string): Promise<HealthDeliveryOutcome> {
  const transport = getSmtpTransport({ connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 });
  const from = getSmtpFrom();
  if (!transport || !from) return 'retry';
  try {
    const result = await transport.sendMail({ from, to, ...buildSpendEmail(input), textEncoding: 'base64', headers: { 'X-GrindCTRL-Notification': 'spend' } });
    return result.rejected?.length || result.pending?.length ? 'retry' : result.accepted?.length ? 'sent' : 'unknown';
  } catch (error) { return healthSmtpFailure(error); }
  finally { transport.close(); }
}
