// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createTransport = vi.hoisted(() => vi.fn((_options: Record<string, unknown>) => ({ sendMail: vi.fn() })));
vi.mock('nodemailer', () => ({ default: { createTransport } }));

import { getSmtpFrom, getSmtpTransport, hasSmtpConfigured } from './transport';

/* Two real misconfigurations this guards, both of which produce a mailbox
   that looks configured and silently sends nothing:

   1. TRYON_EMAIL_SMTP_USER set to the NAME of a Google app password rather
      than the mailbox address. It is the SMTP login and the From header, so
      a label fails auth and yields an invalid From.
   2. The app password pasted as Google displays it — four groups of four
      separated by spaces, which are presentation, not password. */

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TRYON_EMAIL_SMTP_USER;
  delete process.env.TRYON_EMAIL_SMTP_APP_PASSWORD;
});
afterEach(() => {
  delete process.env.TRYON_EMAIL_SMTP_USER;
  delete process.env.TRYON_EMAIL_SMTP_APP_PASSWORD;
});

describe('SMTP transport configuration', () => {
  it('strips the spaces Google shows inside an app password', () => {
    process.env.TRYON_EMAIL_SMTP_USER = 'sender@gmail.com';
    process.env.TRYON_EMAIL_SMTP_APP_PASSWORD = 'abcd efgh ijkl mnop';

    getSmtpTransport();

    const options = createTransport.mock.calls[0][0] as { auth: { user: string; pass: string } };
    expect(options.auth.pass).toBe('abcdefghijklmnop');
    expect(options.auth.user).toBe('sender@gmail.com');
  });

  it('refuses a user that is not an email address', () => {
    // e.g. the label typed into Google's "app password name" box.
    process.env.TRYON_EMAIL_SMTP_USER = 'EMAILS_SENDER_N8n';
    process.env.TRYON_EMAIL_SMTP_APP_PASSWORD = 'abcd efgh ijkl mnop';

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(getSmtpTransport()).toBeNull();
    expect(getSmtpFrom()).toBeNull();
    expect(createTransport).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('agrees with hasSmtpConfigured, so a doomed send is never claimed', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.TRYON_EMAIL_SMTP_USER = 'not-an-address';
    process.env.TRYON_EMAIL_SMTP_APP_PASSWORD = 'pw';
    // Disagreement here is what burns the once-per-handoff notification
    // claim: the caller thinks SMTP is up, claims the right to send, then
    // gets a null transport.
    expect(hasSmtpConfigured()).toBe(false);
    expect(getSmtpTransport()).toBeNull();
    errors.mockRestore();

    process.env.TRYON_EMAIL_SMTP_USER = 'sender@gmail.com';
    expect(hasSmtpConfigured()).toBe(true);
    expect(getSmtpTransport()).not.toBeNull();
  });

  it('treats a whitespace-only password as absent', () => {
    process.env.TRYON_EMAIL_SMTP_USER = 'sender@gmail.com';
    process.env.TRYON_EMAIL_SMTP_APP_PASSWORD = '    ';
    expect(hasSmtpConfigured()).toBe(false);
    expect(getSmtpTransport()).toBeNull();
  });

  it('sends From the mailbox address', () => {
    process.env.TRYON_EMAIL_SMTP_USER = 'sender@gmail.com';
    process.env.TRYON_EMAIL_SMTP_APP_PASSWORD = 'pw';
    expect(getSmtpFrom()).toEqual({ name: 'GRINDCTRL Store Chat', address: 'sender@gmail.com' });
  });
});
