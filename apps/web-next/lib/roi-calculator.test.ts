import { describe, expect, it } from 'vitest';
import {
  calculateRoiScenario,
  validateRoiScenario,
  type RoiScenarioInputs,
} from './roi-calculator';

const base: RoiScenarioInputs = {
  monthlySessions: 10_000,
  baselineConversionRate: 2,
  averageOrderValue: 75,
  returnRate: 10,
  grossMarginRate: 40,
  monthlyCost: 500,
  supportVolume: 1_000,
  leadVolume: 200,
  conversionImprovement: 0.5,
  returnReduction: 2,
  supportAutomationRate: 20,
};

describe('calculateRoiScenario', () => {
  it('separates booked revenue from gross-margin impact', () => {
    const result = calculateRoiScenario(base);

    expect(result.baselineOrders).toBe(200);
    expect(result.baselineRevenue).toBe(15_000);
    expect(result.scenarioOrders).toBe(250);
    expect(result.scenarioRevenue).toBe(18_750);
    expect(result.incrementalRevenue).toBe(3_750);
    expect(result.avoidedReturnValue).toBe(375);
    expect(result.illustrativeGrossMarginImpact).toBe(1_500);
    expect(result.illustrativeNetImpact).toBe(1_000);
    expect(result.illustrativeRoi).toBe(200);
    expect(result.automatedSupportConversations).toBe(200);
  });

  it('makes no uplift or return-reduction assumption when controls are zero', () => {
    const result = calculateRoiScenario({
      ...base,
      conversionImprovement: 0,
      returnReduction: 0,
      supportAutomationRate: 0,
    });

    expect(result.scenarioRevenue).toBe(result.baselineRevenue);
    expect(result.incrementalRevenue).toBe(0);
    expect(result.avoidedReturnValue).toBe(0);
    expect(result.illustrativeNetImpact).toBe(-500);
    expect(result.illustrativeRoi).toBe(-100);
    expect(result.automatedSupportConversations).toBe(0);
  });

  it('does not calculate ROI when no monthly cost is supplied', () => {
    expect(calculateRoiScenario({ ...base, monthlyCost: 0 }).illustrativeRoi).toBeNull();
  });
});

describe('validateRoiScenario', () => {
  it('rejects impossible percentage-point scenarios', () => {
    const errors = validateRoiScenario({
      ...base,
      baselineConversionRate: 99,
      conversionImprovement: 2,
      returnRate: 4,
      returnReduction: 5,
    });

    expect(errors).toContainEqual({
      field: 'conversionImprovement',
      code: 'conversion-above-100',
    });
    expect(errors).toContainEqual({
      field: 'returnReduction',
      code: 'return-reduction-above-rate',
    });
  });

  it('rejects negative and non-finite values', () => {
    const errors = validateRoiScenario({
      ...base,
      monthlySessions: -1,
      leadVolume: Number.NaN,
    });

    expect(errors).toContainEqual({ field: 'monthlySessions', code: 'negative' });
    expect(errors).toContainEqual({ field: 'leadVolume', code: 'not-finite' });
  });

  it('allows a return-rate reduction exactly equal to the baseline rate', () => {
    const errors = validateRoiScenario({ ...base, returnRate: 5, returnReduction: 5 });

    expect(errors).not.toContainEqual(
      expect.objectContaining({ field: 'returnReduction' }),
    );
  });

  it('accepts an all-zero scenario as valid', () => {
    expect(
      validateRoiScenario({
        monthlySessions: 0,
        baselineConversionRate: 0,
        averageOrderValue: 0,
        returnRate: 0,
        grossMarginRate: 0,
        monthlyCost: 0,
        supportVolume: 0,
        leadVolume: 0,
        conversionImprovement: 0,
        returnReduction: 0,
        supportAutomationRate: 0,
      }),
    ).toEqual([]);
  });
});
