// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizeContactEmail, shouldAskForContact } from './contact';

describe('normalizeContactEmail', () => {
  it('lowercases and trims a single address', () => {
    expect(normalizeContactEmail('  Shopper@Example.COM ')).toBe('shopper@example.com');
  });

  it('rejects a list, which is what a header-injection attempt looks like', () => {
    expect(normalizeContactEmail('a@b.com, evil@c.com')).toBeNull();
    expect(normalizeContactEmail('a@b.com; evil@c.com')).toBeNull();
  });

  it('rejects CR/LF and angle brackets outright', () => {
    expect(normalizeContactEmail('a@b.com\nBcc: evil@c.com')).toBeNull();
    expect(normalizeContactEmail('Name <a@b.com>')).toBeNull();
  });

  it('rejects malformed shapes and over-long input', () => {
    expect(normalizeContactEmail('not-an-email')).toBeNull();
    expect(normalizeContactEmail('a@b')).toBeNull();
    expect(normalizeContactEmail('')).toBeNull();
    expect(normalizeContactEmail(42)).toBeNull();
    expect(normalizeContactEmail(`${'a'.repeat(200)}@b.com`)).toBeNull();
  });
});

describe('shouldAskForContact', () => {
  const base = {
    config: { enabled: true, askOutsideHours: true },
    alreadyPrompted: false,
    knownEmail: null,
    justEscalated: false,
    withinHours: true,
  };

  it('asks on escalation', () => {
    expect(shouldAskForContact({ ...base, justEscalated: true })).toBe(true);
  });

  it('asks outside business hours', () => {
    expect(shouldAskForContact({ ...base, withinHours: false })).toBe(true);
  });

  it('stays silent when the AI is answering during business hours', () => {
    // The whole point of the two triggers: a shopper who got an instant
    // answer is not asked for an email. That would be lead capture.
    expect(shouldAskForContact(base)).toBe(false);
  });

  it('never asks twice in one conversation', () => {
    expect(shouldAskForContact({ ...base, justEscalated: true, alreadyPrompted: true })).toBe(false);
  });

  it('never asks when an address is already known', () => {
    expect(shouldAskForContact({ ...base, justEscalated: true, knownEmail: 'a@b.com' })).toBe(false);
  });

  it('respects both switches', () => {
    expect(
      shouldAskForContact({ ...base, justEscalated: true, config: { enabled: false, askOutsideHours: true } }),
    ).toBe(false);
    expect(
      shouldAskForContact({ ...base, withinHours: false, config: { enabled: true, askOutsideHours: false } }),
    ).toBe(false);
    // askOutsideHours off must not disable the handoff trigger.
    expect(
      shouldAskForContact({
        ...base,
        justEscalated: true,
        config: { enabled: true, askOutsideHours: false },
      }),
    ).toBe(true);
  });
});
