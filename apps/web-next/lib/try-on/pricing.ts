export function calculatePerRenderPrice(
  priceMinor: number,
  rendersIncluded: number,
): number {
  if (!Number.isFinite(priceMinor) || priceMinor < 0) {
    throw new Error('Price must be a non-negative finite number');
  }
  if (!Number.isFinite(rendersIncluded) || rendersIncluded <= 0) {
    throw new Error('Renders included must be a positive finite number');
  }
  return priceMinor / 100 / rendersIncluded;
}
