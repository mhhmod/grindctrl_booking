import { beforeEach, describe, expect, it, vi } from 'vitest';

const complete = vi.hoisted(() => vi.fn());
vi.mock('./chat-client', () => ({ storeChatComplete: complete }));

import { generateAssistantReply, phraseOrderAnswer } from './ai';

const INPUT = { prompt: 'system', history: [], userMessage: 'yes please' };

describe('generateAssistantReply handoff marker', () => {
  beforeEach(() => complete.mockReset());

  it('hands off on the exact marker and never shows it', async () => {
    complete.mockResolvedValue('Connecting you with our team now. [[HANDOFF]]');
    const result = await generateAssistantReply(INPUT);
    expect(result.escalate).toBe(true);
    expect(result.reply).toBe('Connecting you with our team now.');
  });

  /* A live reply ended in "[[HANDLOAD]]": no handoff happened and the raw
     token reached the shopper under "I am transferring you". */
  it.each(['[[HANDLOAD]]', '[[handoff]]', '[[ HANDOFF ]]', '[[HAND_OFF]]'])(
    'treats the variant %s as the marker',
    async (marker) => {
      complete.mockResolvedValue(`حسنًا، سأحولك إلى فريق الدعم. ${marker}`);
      const result = await generateAssistantReply(INPUT);
      expect(result.escalate).toBe(true);
      expect(result.reply).toBe('حسنًا، سأحولك إلى فريق الدعم.');
    },
  );

  it('does not hand off without a marker', async () => {
    complete.mockResolvedValue('Shipping to Giza is 60 EGP.');
    const result = await generateAssistantReply(INPUT);
    expect(result.escalate).toBe(false);
    expect(result.reply).toBe('Shipping to Giza is 60 EGP.');
  });
});

describe('phraseOrderAnswer', () => {
  it('never shows a handoff marker, since this turn cannot hand off', async () => {
    complete.mockResolvedValue('Your order shipped yesterday. [[HANDLOAD]]');
    const text = await phraseOrderAnswer({ ...INPUT, facts: {} as never });
    expect(text).toBe('Your order shipped yesterday.');
  });
});
