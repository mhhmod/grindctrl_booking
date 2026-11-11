/** Match only our optional columns, not unrelated schema or policy errors. */
export function missingProductInfo(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === '42703' || error.code === 'PGRST204') &&
    /\bproduct_(?:title|image_url)\b/.test(error.message ?? ''));
}
