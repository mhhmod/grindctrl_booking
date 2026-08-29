import 'server-only';
import nodemailer from 'nodemailer';

/* One sending account for the whole app. The env vars carry the TRYON_
   prefix for historical reasons — the Try-On campaign was the first thing
   to send mail — but this is the app's mailbox, not that feature's. */
export function getSmtpTransport(): nodemailer.Transporter | null {
  const user = process.env.TRYON_EMAIL_SMTP_USER?.trim();
  const pass = process.env.TRYON_EMAIL_SMTP_APP_PASSWORD?.trim();
  if (!user || !pass) return null;

  const port = Number(process.env.TRYON_EMAIL_SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.TRYON_EMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getSmtpFrom(): { name: string; address: string } | null {
  const address = process.env.TRYON_EMAIL_SMTP_USER?.trim();
  if (!address) return null;
  return { name: process.env.STORE_CHAT_EMAIL_FROM_NAME?.trim() || 'GRINDCTRL Store Chat', address };
}
