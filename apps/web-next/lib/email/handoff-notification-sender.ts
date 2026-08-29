import 'server-only';
import { buildHandoffNotification, type HandoffNotificationInput } from './handoff-notification';
import { getSmtpFrom, getSmtpTransport } from './transport';

/* Never throws. A notification is a courtesy on top of a conversation that
   has already been escalated — losing the email must not lose the handoff.
   `input` comes off DB rows and merchant JSON, where TS types are
   assertions rather than guarantees, so build+send both run inside the try
   below rather than before it. */
export async function sendHandoffNotification(
  input: HandoffNotificationInput & { to: string[] },
): Promise<{ sent: boolean }> {
  if (!Array.isArray(input.to) || input.to.length === 0) return { sent: false };
  const transport = getSmtpTransport();
  const from = getSmtpFrom();
  if (!transport || !from) return { sent: false };

  try {
    const { subject, html, text } = buildHandoffNotification(input);
    await transport.sendMail({
      from,
      // Recipients go in Bcc, not To: `to` is every workspace owner/admin
      // (up to 5), and nodemailer joins a To array into one visible,
      // Reply-All-able header — Bcc keeps their addresses private from
      // each other while nodemailer still strips Bcc from the wire.
      to: from.address,
      bcc: input.to,
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
