import { describe, expect, it } from 'vitest';
import { formatProviderCost, reportedCostUsd, summarizeProviderCosts } from './provider-cost';

describe('provider cost evidence', () => {
  it.each([null, undefined, Number.NaN, Infinity, -1, '0'])('keeps unreported or invalid cost unknown (%s)', (value) => {
    expect(reportedCostUsd(value)).toBeNull();
    expect(formatProviderCost(value, 'Unreported')).toBe('Unreported');
  });
  it('keeps a reported zero different from unknown cost', () => {
    expect(formatProviderCost(0, 'Unreported', 4)).toBe('$0.0000');
    expect(summarizeProviderCosts([0])).toEqual({ knownSpendUsd: 0, missingCostCount: 0 });
    expect(summarizeProviderCosts([null])).toEqual({ knownSpendUsd: null, missingCostCount: 1 });
  });
  it('retains known spend while exposing the count omitted from a partial total', () => {
    expect(summarizeProviderCosts([0, 0.25, null, -1]))
      .toEqual({ knownSpendUsd: 0.25, missingCostCount: 2 });
    expect(summarizeProviderCosts([])).toEqual({ knownSpendUsd: 0, missingCostCount: 0 });
  });
});
