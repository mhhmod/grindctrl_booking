/** Missing, invalid or negative provider usage is not evidence of zero spend. */
export function reportedCostUsd(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function summarizeProviderCosts(values: readonly unknown[]): {
  knownSpendUsd: number | null;
  missingCostCount: number;
} {
  let total = 0;
  let missingCostCount = 0;
  for (const value of values) {
    const cost = reportedCostUsd(value);
    if (cost === null) missingCostCount += 1;
    else total += cost;
  }
  return {
    knownSpendUsd: values.length > 0 && missingCostCount === values.length ? null : total,
    missingCostCount,
  };
}

export function formatProviderCost(value: unknown, unreportedLabel: string, digits = 2): string {
  const cost = reportedCostUsd(value);
  return cost === null ? unreportedLabel : `$${cost.toFixed(digits)}`;
}
