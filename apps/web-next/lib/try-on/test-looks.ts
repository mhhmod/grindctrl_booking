/* Test looks are left out of every number (N5, phase zero item 9). The
   column exists once the owner applies supabase/store_launch.sql; until
   then a read filtering on it fails with an undefined column, and is run
   again without the filter, since no test look can exist yet. */

type QueryError = { code?: string; message: string } | null;

function missingTestColumn(error: QueryError): boolean {
  return Boolean(error && (error.code === '42703' || /is_test/.test(error.message)));
}

export async function withoutTestLooks<T extends { error: QueryError }>(
  run: (excludeTestLooks: boolean) => PromiseLike<T>,
): Promise<T> {
  const filtered = await run(true);
  return missingTestColumn(filtered.error) ? run(false) : filtered;
}
