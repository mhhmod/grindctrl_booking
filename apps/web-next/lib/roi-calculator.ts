export interface RoiScenarioInputs {
  monthlySessions: number;
  baselineConversionRate: number;
  averageOrderValue: number;
  returnRate: number;
  grossMarginRate: number;
  monthlyCost: number;
  supportVolume: number;
  leadVolume: number;
  conversionImprovement: number;
  returnReduction: number;
  supportAutomationRate: number;
}

export interface RoiScenarioResult {
  baselineOrders: number;
  baselineRevenue: number;
  scenarioConversionRate: number;
  scenarioReturnRate: number;
  scenarioOrders: number;
  scenarioRevenue: number;
  incrementalRevenue: number;
  avoidedReturnValue: number;
  illustrativeGrossMarginImpact: number;
  illustrativeNetImpact: number;
  illustrativeRoi: number | null;
  automatedSupportConversations: number;
}

export type RoiScenarioField = keyof RoiScenarioInputs;

export interface RoiScenarioValidationError {
  field: RoiScenarioField;
  code: 'not-finite' | 'negative' | 'above-100' | 'conversion-above-100' | 'return-reduction-above-rate';
}

/**
 * Models one merchant-selected scenario. Rates are percentage points, not
 * relative percentages: a 2% baseline plus 0.5 points becomes 2.5%.
 *
 * The financial impact is deliberately based on gross-margin contribution,
 * not gross booked revenue. Optional support and lead volumes stay outside the
 * money model because a per-conversation saving and lead value were not given.
 */
export function calculateRoiScenario(input: RoiScenarioInputs): RoiScenarioResult {
  const baselineConversion = input.baselineConversionRate / 100;
  const scenarioConversionRate = input.baselineConversionRate + input.conversionImprovement;
  const scenarioConversion = scenarioConversionRate / 100;
  const baselineReturnRate = input.returnRate / 100;
  const returnReduction = input.returnReduction / 100;
  const grossMargin = input.grossMarginRate / 100;

  const baselineOrders = input.monthlySessions * baselineConversion;
  const baselineRevenue = baselineOrders * input.averageOrderValue;
  const scenarioOrders = input.monthlySessions * scenarioConversion;
  const scenarioRevenue = scenarioOrders * input.averageOrderValue;
  const incrementalRevenue = scenarioRevenue - baselineRevenue;

  // Uses scenario booked revenue so the reduction applies to all orders in the
  // selected scenario, while the incremental-order contribution below remains
  // adjusted by the merchant's baseline return rate.
  const avoidedReturnValue = scenarioRevenue * returnReduction;
  const retainedValueFromIncrementalOrders = incrementalRevenue * (1 - baselineReturnRate);
  const illustrativeGrossMarginImpact =
    (retainedValueFromIncrementalOrders + avoidedReturnValue) * grossMargin;
  const illustrativeNetImpact = illustrativeGrossMarginImpact - input.monthlyCost;

  return {
    baselineOrders,
    baselineRevenue,
    scenarioConversionRate,
    scenarioReturnRate: input.returnRate - input.returnReduction,
    scenarioOrders,
    scenarioRevenue,
    incrementalRevenue,
    avoidedReturnValue,
    illustrativeGrossMarginImpact,
    illustrativeNetImpact,
    illustrativeRoi:
      input.monthlyCost > 0 ? (illustrativeNetImpact / input.monthlyCost) * 100 : null,
    automatedSupportConversations:
      input.supportVolume * (input.supportAutomationRate / 100),
  };
}

const PERCENTAGE_FIELDS: RoiScenarioField[] = [
  'baselineConversionRate',
  'returnRate',
  'grossMarginRate',
  'conversionImprovement',
  'returnReduction',
  'supportAutomationRate',
];

export function validateRoiScenario(input: RoiScenarioInputs): RoiScenarioValidationError[] {
  const errors: RoiScenarioValidationError[] = [];

  for (const [field, value] of Object.entries(input) as [RoiScenarioField, number][]) {
    if (!Number.isFinite(value)) {
      errors.push({ field, code: 'not-finite' });
    } else if (value < 0) {
      errors.push({ field, code: 'negative' });
    }
  }

  for (const field of PERCENTAGE_FIELDS) {
    if (Number.isFinite(input[field]) && input[field] > 100) {
      errors.push({ field, code: 'above-100' });
    }
  }

  if (
    Number.isFinite(input.baselineConversionRate) &&
    Number.isFinite(input.conversionImprovement) &&
    input.baselineConversionRate + input.conversionImprovement > 100
  ) {
    errors.push({ field: 'conversionImprovement', code: 'conversion-above-100' });
  }

  if (
    Number.isFinite(input.returnRate) &&
    Number.isFinite(input.returnReduction) &&
    input.returnReduction > input.returnRate
  ) {
    errors.push({ field: 'returnReduction', code: 'return-reduction-above-rate' });
  }

  return errors;
}
