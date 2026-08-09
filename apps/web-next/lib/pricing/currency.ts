/* Which currency a visitor sees, and which catalog rows back it.

   EGP is real catalog rows the owner prices, not a conversion of the USD
   number. PLANS.md computes every margin against provider costs quoted in USD
   and treats catalog rows as immutable once a subscription references them —
   a converted price would contradict both, drift daily, and hide margin
   erosion when EGP moves. */

export const CURRENCY_COOKIE = 'gc-currency';

export const CURRENCIES = ['USD', 'EGP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'USD';

/* A short explicit map rather than a lookup by region. Adding a currency means
   adding catalog rows at a price the owner chose, so a country listed here
   without rows would show a page with no plans on it. */
const COUNTRY_CURRENCY: Record<string, Currency> = {
  EG: 'EGP',
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

export function resolveCurrency({
  cookie,
  country,
}: {
  cookie: string | null;
  country: string | null;
}): Currency {
  /* An explicit choice always wins. Someone who corrected a wrong guess should
     not have it re-guessed on the next page load. */
  if (isCurrency(cookie)) return cookie;

  if (country) {
    const detected = COUNTRY_CURRENCY[country.toUpperCase()];
    if (detected) return detected;
  }

  return DEFAULT_CURRENCY;
}

export function plansForCurrency<T extends { currency: string; isFree?: boolean }>(
  rows: T[],
  currency: Currency,
): T[] {
  /* A free plan costs nothing in every currency, so it is never duplicated per
     currency — and the database enforces that: tryon_plans_one_active_free
     permits exactly one active free plan. Filtering it out by currency would
     drop the free tier from the EGP page entirely, so it is always kept.

     Packs have no isFree field; undefined is falsy, so they are all treated as
     paid, which is correct. */
  const free = rows.filter((row) => row.isFree);
  const paid = rows.filter((row) => !row.isFree && row.currency === currency);

  if (paid.length) return [...free, ...paid];

  /* Nothing paid in the active currency. Fall back to the default rather than
     rendering a page with only a free plan on it. */
  return rows.filter((row) => row.isFree || row.currency === DEFAULT_CURRENCY);
}
