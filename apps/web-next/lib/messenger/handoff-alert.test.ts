import { describe, expect, it } from 'vitest';
import { alertIsDue, publicAlertFor, readHandoffAlert } from './handoff-alert';

const SENT = { status: 'sent', reason: null, channels: ['email'], at: '2026-10-16T12:00:00Z', attempts: 1 };

describe('handoff alert (phase zero item 6)', () => {
  it('shows the panel the outcome, never the merchant-side reason', () => {
    const conversation = {
      status: 'handoff_requested',
      metadata: { handoff_alert: { ...SENT, status: 'none', reason: 'no_recipient', channels: [] } },
    };
    expect(publicAlertFor(conversation)).toEqual({ status: 'none', channels: [], at: SENT.at, afterHours: false });
  });

  it('has no alert outside a handoff, or for a malformed record', () => {
    expect(publicAlertFor({ status: 'open', metadata: { handoff_alert: SENT } })).toBeNull();
    expect(readHandoffAlert({ handoff_alert: { status: 'maybe', at: 'x' } })).toBeNull();
    expect(readHandoffAlert({})).toBeNull();
  });

  it('is due when pending, and a deferred one only from its time', () => {
    const now = Date.parse('2026-10-16T12:00:00Z');
    expect(alertIsDue(readHandoffAlert({ handoff_alert: { ...SENT, status: 'pending' } }), now)).toBe(true);
    expect(alertIsDue(readHandoffAlert({ handoff_alert: SENT }), now)).toBe(false);
    const deferred = { ...SENT, status: 'pending', reason: 'after_hours', dueAt: '2026-10-16T13:00:00Z' };
    expect(alertIsDue(readHandoffAlert({ handoff_alert: deferred }), now)).toBe(false);
    expect(alertIsDue(readHandoffAlert({ handoff_alert: deferred }), now + 3_600_000)).toBe(true);
  });
});
