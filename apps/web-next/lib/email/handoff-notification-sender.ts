import 'server-only';
import { buildHandoffNotification, type HandoffNotificationInput } from './handoff-notification';
import { getSmtpFrom, getSmtpTransport } from './transport';

/* Never throws. A notification is a courtesy on top of a conversation that
   has already been escalated — losing the email must not lose the handoff. */
export async function sendHandoffNotification(
  input: HandoffNotificationInput & { to: string[] },
): Promise<{ sent: boolean }> {
  if (input.to.length === 0) return { sent: false };
  const transport = getSmtpTransport();
  const from = getSmtpFrom();
  if (!transport || !from) return { sent: false };

  const { subject, html, text } = buildHandoffNotification(input);
  try {
    await transport.sendMail({
      from,
      to: input.to,
      subject,
      html,
      text,
      textEncoding: 'base64',
      headers: { 'X-GrindCTRL-Notification': 'store-chat-handoff' },
    });
    return { sent: true };
  } catch (error) {
    console.error('[messenger] handoff email failed:', error instanceof Error ? error.message : error);
    return { sent: false };
  }
}
