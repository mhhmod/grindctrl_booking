import { describe, expect, it } from 'vitest';
import { tallyChatOutcomes, type OutcomeConversation, type OutcomeMessage } from './chat-outcomes';

const chat = (over: Partial<OutcomeConversation> & { id: string }): OutcomeConversation => ({
  status: 'open',
  handoff_reason: null,
  assigned_profile_id: null,
  ...over,
});
const reply = (conversation_id: string, author: 'ai' | 'human', internal = false): OutcomeMessage => ({
  conversation_id,
  role: 'assistant',
  metadata: { author, ...(internal ? { internal: true } : {}) },
});

describe('who finished a chat', () => {
  it('counts an open chat the assistant answered, where the old count saw only closed ones', () => {
    expect(tallyChatOutcomes([chat({ id: 'a' })], [reply('a', 'ai')])).toEqual({ answered: 1, handedOff: 0 });
  });

  it('counts a chat the assistant answered after the shopper asked for a person nobody has taken yet', () => {
    const waiting = chat({ id: 'a', status: 'handoff_requested', handoff_reason: 'asked for a person' });
    expect(tallyChatOutcomes([waiting], [reply('a', 'ai')])).toEqual({ answered: 1, handedOff: 0 });
  });

  it('hands a chat on once a person replied, took it over or was assigned', () => {
    const rows = [
      chat({ id: 'replied' }),
      chat({ id: 'active', status: 'handoff_active' }),
      chat({ id: 'assigned', assigned_profile_id: 'p1' }),
    ];
    const messages = [reply('replied', 'ai'), reply('replied', 'human'), reply('active', 'ai'), reply('assigned', 'ai')];
    expect(tallyChatOutcomes(rows, messages)).toEqual({ answered: 0, handedOff: 3 });
  });

  it('does not take a staff-only note for a person answering the shopper', () => {
    expect(tallyChatOutcomes([chat({ id: 'a' })], [reply('a', 'ai'), reply('a', 'human', true)])).toEqual({ answered: 1, handedOff: 0 });
  });

  it('hands on a chat still waiting for a person that the assistant never answered, and ignores one nobody answered', () => {
    const rows = [chat({ id: 'waiting', status: 'handoff_requested' }), chat({ id: 'idle' })];
    expect(tallyChatOutcomes(rows, [])).toEqual({ answered: 0, handedOff: 1 });
  });
});
