import { describe, expect, it } from 'vitest';
import { takeVerdict, verdictInstructions } from './verdict';

describe('the reply verdict', () => {
  it('takes a well-formed verdict out of the reply', () => {
    const { text, verdict } = takeVerdict(
      'Exchanges are free within 30 days.\n[[VERDICT {"answered":true,"intent":"policy_question","product":"Layla abaya","upset":false}]]',
    );
    expect(text).toBe('Exchanges are free within 30 days.');
    expect(verdict).toEqual({ answered: true, intent: 'policy_question', product: 'Layla abaya', upset: false });
  });

  it('keeps the handoff marker for the route and drops the verdict after it', () => {
    const { text, verdict } = takeVerdict(
      'I am bringing in the team. [[HANDOFF]]\n[[VERDICT {"answered":true,"intent":"refund_request","product":null,"upset":true}]]',
    );
    expect(text).toBe('I am bringing in the team. [[HANDOFF]]');
    expect(verdict).toMatchObject({ intent: 'refund_request', upset: true });
  });

  it('never lets a broken or cut-off verdict reach the shopper', () => {
    expect(takeVerdict('Sure.\n[[VERDICT {"answered":fal').text).toBe('Sure.');
    expect(takeVerdict('Sure.\n[[VERDICT {"answered":fal').verdict).toBeNull();
    expect(takeVerdict('Sure. [[ verdict not json ]]').text).toBe('Sure.');
    expect(takeVerdict('Sure. [[VERDICT []]]').verdict).toBeNull();
  });

  it('reads unknown values safely', () => {
    const { verdict } = takeVerdict('Hi [[VERDICT {"answered":"maybe","intent":"steal","product":"   ","upset":"yes"}]]');
    expect(verdict).toEqual({ answered: true, intent: 'other', product: null, upset: false });
  });

  it('leaves a reply without a verdict alone', () => {
    expect(takeVerdict('We ship in two days.')).toEqual({ text: 'We ship in two days.', verdict: null });
  });

  it('teaches the store\'s own big-order count', () => {
    expect(verdictInstructions(8)).toContain('when they want 8 or more of one piece');
  });
});
