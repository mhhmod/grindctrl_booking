import { describe, expect, it } from 'vitest';
import { countAlertProblems } from './conversations';

describe('countAlertProblems (phase zero item 6)', () => {
  it('counts each conversation once per reason, and leaves out what is not a problem', () => {
    expect(
      countAlertProblems([
        { conversation_id: 'c1', event_name: 'handoff_notify_failed', payload: {} },
        { conversation_id: 'c1', event_name: 'handoff_notify_failed', payload: {} },
        { conversation_id: 'c2', event_name: 'handoff_notify_skipped', payload: { reason: 'no_recipient' } },
        { conversation_id: 'c3', event_name: 'handoff_notify_skipped', payload: { reason: 'already_claimed' } },
        { conversation_id: 'c4', event_name: 'handoff_notify_throttled', payload: {} },
        { conversation_id: 'c5', event_name: 'handoff_notified', payload: {} },
      ]),
    ).toEqual({ send_failed: 1, no_recipient: 1, throttled: 1 });
  });
});
