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

export function plansForCurrency<T extends { currency: string }>(
  rows: T[],
  currency: Currency,
): T[] {
  const matching = rows.filter((row) => row.currency === currency);
  if (matching.length) return matching;

  /* No rows in the active currency — which is exactly the state until the EGP
     rows are added. Show the USD ones rather than an empty pricing page. */
  return rows.filter((row) => row.currency === DEFAULT_CURRENCY);
}
