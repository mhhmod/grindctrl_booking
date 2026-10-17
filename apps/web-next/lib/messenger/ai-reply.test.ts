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

describe('the reply verdict (phase zero items 10 and 11)', () => {
  beforeEach(() => complete.mockReset());

  it('hands the verdict to the route and never shows it', async () => {
    complete.mockResolvedValue(
      'I am bringing in the team. [[HANDOFF]]\n[[VERDICT {"answered":true,"intent":"refund_request","product":null,"upset":false}]]',
    );
    const result = await generateAssistantReply(INPUT);
    expect(result.reply).toBe('I am bringing in the team.');
    expect(result.escalate).toBe(true);
    expect(result.raw).not.toContain('VERDICT');
    expect(result.verdict).toEqual({ answered: true, intent: 'refund_request', product: null, upset: false });
  });

  it('keeps an action line parseable when a verdict follows it', async () => {
    complete.mockResolvedValue(
      '<<GC_ACTION>>{"action":"lookup_order"}\n[[VERDICT {"answered":true,"intent":"other","product":null,"upset":false}]]',
    );
    const result = await generateAssistantReply(INPUT);
    expect(result.raw).toBe('<<GC_ACTION>>{"action":"lookup_order"}');
  });

  it('gives a turn that asks for the verdict more room, since the model reasons first', async () => {
    complete.mockResolvedValue('Sure.');
    await generateAssistantReply(INPUT);
    expect(complete.mock.calls[0][1].maxTokens).toBe(400);
    await generateAssistantReply({ ...INPUT, verdict: true });
    expect(complete.mock.calls[1][1].maxTokens).toBe(1_200);
  });

  it('drops a verdict from an order answer too', async () => {
    complete.mockResolvedValue('Your order shipped. [[VERDICT {"answered":true,"intent":"other","product":null,"upset":false}]]');
    expect(await phraseOrderAnswer({ ...INPUT, facts: {} as never })).toBe('Your order shipped.');
  });
});
