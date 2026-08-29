// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ponytail: typed param only so `mock.calls[0][0]` isn't an empty tuple under strict tsc — no behavior change.
const sendMail = vi.hoisted(() => vi.fn(async (_message: Record<string, unknown>) => ({ messageId: 'mid-1' })));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

import { sendHandoffNotification } from './handoff-notification-sender';

const INPUT = {
  to: ['owner@store.com'],
  storeName: 'Sara’s Store',
  siteId: 'site-1',
  locale: 'en' as const,
  shopperLabel: 'anonymous shopper',
  reason: 'assistant_escalated',
  summary: 'AI could not answer a returns question',
  recentMessages: [{ role: 'user' as const, content: 'can I return this?' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TRYON_EMAIL_SMTP_USER = 'bot@grindctrl.cloud';
  process.env.TRYON_EMAIL_SMTP_APP_PASSWORD = 'app-password';
});
afterEach(() => {
  delete process.env.TRYON_EMAIL_SMTP_USER;
  delete process.env.TRYON_EMAIL_SMTP_APP_PASSWORD;
});

describe('sendHandoffNotification', () => {
  it('sends one message addressed to every recipient', async () => {
    await sendHandoffNotification(INPUT);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toEqual(['owner@store.com']);
    expect(message.subject).toContain('Sara’s Store');
    expect(message.html).toContain('can I return this?');
  });

  it('reports failure instead of throwing, so a send never breaks a handoff', async () => {
    sendMail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(sendHandoffNotification(INPUT)).resolves.toEqual({ sent: false });
  });

  it('does nothing when the SMTP account is not configured', async () => {
    delete process.env.TRYON_EMAIL_SMTP_USER;
    await expect(sendHandoffNotification(INPUT)).resolves.toEqual({ sent: false });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends nothing when there are no recipients', async () => {
    await expect(sendHandoffNotification({ ...INPUT, to: [] })).resolves.toEqual({ sent: false });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
