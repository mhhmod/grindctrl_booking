import 'server-only';
import nodemailer from 'nodemailer';

/* One sending account for the whole app. The env vars carry the TRYON_
   prefix for historical reasons — the Try-On campaign was the first thing
   to send mail — but this is the app's mailbox, not that feature's.

   TRYON_EMAIL_SMTP_USER is the FULL EMAIL ADDRESS of the sending mailbox.
   It is both the SMTP login and the From address, so a label, a display
   name, or the name given to an app password in the Google account UI will
   fail authentication and produce an invalid From header. The `@` check
   below turns that mistake into a loud, once-per-boot log line instead of a
   run of confusing 535s. */

function readUser(): string | null {
  const user = process.env.TRYON_EMAIL_SMTP_USER?.trim();
  if (!user) return null;
  if (!user.includes('@')) {
    if (!warnedAboutUser) {
      warnedAboutUser = true;
      console.error(
        `[email] TRYON_EMAIL_SMTP_USER is "${user}", which is not an email address. ` +
          'It must be the full mailbox address (for example name@gmail.com) — it is used both ' +
          'as the SMTP login and as the From header. Mail is disabled until this is fixed.',
      );
    }
    return null;
  }
  return user;
}
let warnedAboutUser = false;

/* Google displays app passwords in four groups of four for readability and
   documents that the spaces are not part of the password. Pasting the
   displayed form is the normal thing to do, so strip whitespace here rather
   than authenticating with a password that has spaces in it. */
function readPassword(): string | null {
  const raw = process.env.TRYON_EMAIL_SMTP_APP_PASSWORD;
  if (!raw) return null;
  const pass = raw.replace(/\s+/g, '');
  return pass || null;
}

export function getSmtpTransport(): nodemailer.Transporter | null {
  const user = readUser();
  const pass = readPassword();
  if (!user || !pass) return null;

  const port = Number(process.env.TRYON_EMAIL_SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.TRYON_EMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/** Cheap, synchronous config check — callers that need to bail before doing
 *  any work (e.g. before claiming a once-only send) shouldn't have to build
 *  a transport just to find out SMTP isn't configured. Agrees with
 *  getSmtpTransport() on what "configured" means, so a malformed user is
 *  recorded as smtp_not_configured rather than burning a once-per-handoff
 *  claim on a send that cannot succeed. */
export function hasSmtpConfigured(): boolean {
  return Boolean(readUser() && readPassword());
}

export function getSmtpFrom(): { name: string; address: string } | null {
  const address = readUser();
  if (!address) return null;
  return { name: process.env.STORE_CHAT_EMAIL_FROM_NAME?.trim() || 'GRINDCTRL Store Chat', address };
}
