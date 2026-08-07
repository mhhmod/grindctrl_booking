# Plan Names and Currency Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show plan names in Arabic to Arabic readers, and prices in the currency that matches where the visitor is.

**Architecture:** EGP becomes real catalog rows the owner prices, not a live conversion — `PLANS.md` computes margins in USD and treats rows as immutable once referenced, and conversion would contradict both. Currency is resolved server-side from an explicit cookie, falling back to a country derived from the client IP by a GeoLite2 database read locally out of the image, falling back to USD. A switcher is always visible because IP detection is inherently wrong for VPNs and travellers.

**Tech Stack:** Next 15.5 App Router, React 19, TypeScript, Vitest 3.2.4, `maxmind` npm package, GeoLite2-Country database, Supabase Postgres.

**Spec:** `docs/superpowers/specs/2026-08-05-plan-currency-localization-design.md`

**Branch:** create `feat/plan-currency-localization` off `main`. Run this AFTER the try-on i18n plan lands — that plan's gate is what stops an untranslated plan name reappearing.

**Working directory:** paths are relative to `apps/web-next` unless stated otherwise.

---

## Blocked item, read first

**Task 7 needs prices only the owner can set.** Do not invent EGP numbers. If you
reach Task 7 without them, complete Tasks 1–6, commit, and report that Task 7 is
waiting on values. Everything before it is independently useful: the code paths
ship inert until EGP rows exist, because with no EGP rows the resolver finds
nothing to show and stays on USD.

---

## Conventions

Run one test file: `npx vitest run <path>`
Run everything: `npx vitest run` — baseline **83 files / 276 tests** plus whatever
the i18n plan added. Zero failures.

Existing code you will build on:

- `components/pricing/pricing-page-content.tsx:33` — `formatCurrency(value, currency, locale, fractionDigits)`
- `components/pricing/pricing-page-content.tsx:87` — already formats using `plan.currency`, the row's own currency
- `lib/try-on/public-catalog.ts:150` — `listPublicPlanCatalog(): Promise<PublicEntitlementCatalog>`
- `components/landing/site-landing.tsx` — `getPlanCopyKey()` maps `launch-*` to `launch-v1`

That last one matters: an EGP row named `launch-v1-egp` inherits the `launch-v1`
copy with no code change.

---

### Task 1: Arabic plan names

The Arabic dictionary currently holds English plan names at
`lib/landing/landing-i18n.ts:365-369`. The type is `Record<string, string>`, so
English values satisfy it — TypeScript cannot catch this class of bug, which is
why it survived. Only a content assertion catches it.

**Files:**
- Modify: `lib/landing/landing-i18n.ts` (Arabic dictionary, around line 365)
- Test: `lib/landing/landing-i18n.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getLandingDictionary } from '@/lib/landing/landing-i18n';

describe('Arabic landing dictionary', () => {
  /* Record<string, string> lets an English value satisfy the type, so the
     compiler cannot help here. This is the only thing that catches it. */
  it('has Arabic plan names, not English ones', () => {
    const ar = getLandingDictionary('ar');

    for (const [key, name] of Object.entries(ar.pricingPlanNames)) {
      expect(name, `plan ${key} is still Latin: ${name}`).not.toMatch(/[A-Za-z]/);
    }
  });

  it('names all three plans in both languages', () => {
    const en = getLandingDictionary('en');
    const ar = getLandingDictionary('ar');

    expect(Object.keys(ar.pricingPlanNames).sort())
      .toEqual(Object.keys(en.pricingPlanNames).sort());
  });
});
```

Confirm the real export name before writing this — check
`lib/landing/landing-i18n.ts` for whether the getter is `getLandingDictionary`
or something else, and use what exists.

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run lib/landing/landing-i18n.test.ts`
Expected: FAIL — `plan free-v1 is still Latin: Free`

- [ ] **Step 3: Translate the names**

Replace lines 365–369:

```ts
  pricingPlanNames: {
    'free-v1': 'مجاني',
    'launch-v1': 'انطلاق',
    'dfy-v1': 'خدمة كاملة',
  },
```

`خدمة كاملة` — "full service" — rather than a literal rendering of
done-for-you, because it is what a merchant would actually say. Leave the
English dictionary at lines 202–206 unchanged.

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run lib/landing/landing-i18n.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add lib/landing/landing-i18n.ts lib/landing/landing-i18n.test.ts
git commit -m "fix: name the plans in Arabic on the Arabic pricing page"
```

---

### Task 2: Currency resolution

A pure function. All the decisions live here, which is what makes them testable
without a browser, a database, or a network.

**Files:**
- Create: `lib/pricing/currency.ts`
- Test: `lib/pricing/currency.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { CURRENCY_COOKIE, resolveCurrency, type Currency } from '@/lib/pricing/currency';

describe('resolveCurrency', () => {
  it('honours an explicit cookie over the detected country', () => {
    expect(resolveCurrency({ cookie: 'USD', country: 'EG' })).toBe('USD');
    expect(resolveCurrency({ cookie: 'EGP', country: 'US' })).toBe('EGP');
  });

  it('uses EGP for Egypt when no cookie is set', () => {
    expect(resolveCurrency({ cookie: null, country: 'EG' })).toBe('EGP');
  });

  it('uses USD for every other country', () => {
    expect(resolveCurrency({ cookie: null, country: 'US' })).toBe('USD');
    expect(resolveCurrency({ cookie: null, country: 'SA' })).toBe('USD');
  });

  /* Every failure path lands on USD. A pricing page showing the wrong currency
     is a bad guess; one that throws is an outage. */
  it('falls back to USD when nothing is known', () => {
    expect(resolveCurrency({ cookie: null, country: null })).toBe('USD');
  });

  it('ignores an unrecognised cookie value rather than trusting it', () => {
    expect(resolveCurrency({ cookie: 'BTC', country: 'EG' })).toBe('EGP');
    expect(resolveCurrency({ cookie: '', country: null })).toBe('USD');
  });

  it('is case-insensitive about the country code', () => {
    expect(resolveCurrency({ cookie: null, country: 'eg' })).toBe('EGP');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run lib/pricing/currency.test.ts`
Expected: FAIL — unresolved import

- [ ] **Step 3: Write the module**

```ts
export const CURRENCY_COOKIE = 'gc-currency';

export const CURRENCIES = ['USD', 'EGP'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'USD';

/* Country to currency. Deliberately a short explicit map rather than a lookup
   by region: adding a currency means adding a catalog row at a price the owner
   chose, so a country appearing here without rows would show nothing. */
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
  /* An explicit choice always wins — a visitor who corrected a wrong guess
     should not have it re-guessed on the next page load. */
  if (isCurrency(cookie)) return cookie;

  if (country) {
    const detected = COUNTRY_CURRENCY[country.toUpperCase()];
    if (detected) return detected;
  }

  return DEFAULT_CURRENCY;
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run lib/pricing/currency.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add lib/pricing/currency.ts lib/pricing/currency.test.ts
git commit -m "feat: decide the display currency in one testable place"
```

---

### Task 3: Country lookup from the client IP

**Files:**
- Create: `lib/pricing/geo.ts`
- Modify: `apps/web-next/Dockerfile` (repo root path: `apps/web-next/Dockerfile`)
- Modify: `package.json` (add `maxmind`)

- [ ] **Step 1: Add the dependency**

```bash
npm install maxmind
```

Use `maxmind`, NOT `geoip-lite`. `geoip-lite` bundles its dataset as an install
of roughly 150MB and the VPS runs at about 91% disk.

- [ ] **Step 2: Write the module**

```ts
import { open, type Reader, type CountryResponse } from 'maxmind';

/* Country lookup for pricing. Reads a GeoLite2 database from disk, so nothing
   is fetched while rendering and no third party is ever sent a visitor's IP.

   Every failure path returns null and the caller falls back to USD: a missing
   database file, an unparseable address, a country not in the data. A pricing
   page must render. */

const DB_PATH = process.env.GEOLITE2_COUNTRY_DB ?? '/app/geo/GeoLite2-Country.mmdb';

let readerPromise: Promise<Reader<CountryResponse> | null> | null = null;

function getReader(): Promise<Reader<CountryResponse> | null> {
  /* Cached across requests: opening the database per request would read ~6MB
     of file for every page view. */
  readerPromise ??= open<CountryResponse>(DB_PATH).catch(() => null);
  return readerPromise;
}

/* x-forwarded-for is a comma-separated chain; the client is the first entry.
   The app already reads it this way for rate limiting in
   app/api/try-on/generate/route.ts. */
export function clientIpFromHeader(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first || null;
}

export async function countryFromIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;

  try {
    const reader = await getReader();
    return reader?.get(ip)?.country?.iso_code ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Test the header parsing**

Create `lib/pricing/geo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clientIpFromHeader } from '@/lib/pricing/geo';

describe('clientIpFromHeader', () => {
  it('takes the client from the front of the chain', () => {
    expect(clientIpFromHeader('203.0.113.7, 10.0.0.1, 10.0.0.2')).toBe('203.0.113.7');
  });

  it('handles a single address', () => {
    expect(clientIpFromHeader('203.0.113.7')).toBe('203.0.113.7');
  });

  it('returns null when the header is missing or empty', () => {
    expect(clientIpFromHeader(null)).toBeNull();
    expect(clientIpFromHeader('')).toBeNull();
    expect(clientIpFromHeader('   ')).toBeNull();
  });
});
```

The database lookup itself is not unit-tested — it is a third-party library
reading a data file. What is tested is the logic around it, which is where the
decisions are.

Run: `npx vitest run lib/pricing/geo.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 4: Get the database into the image**

Read `apps/web-next/Dockerfile` first to see its stage names, then add a step
that places `GeoLite2-Country.mmdb` at `/app/geo/GeoLite2-Country.mmdb` in the
runner stage.

MaxMind requires a free account and a license key to download GeoLite2. Add the
key as a build argument rather than committing it. The build MUST still succeed
without it — if the download fails, the file is absent, `open()` rejects,
`getReader()` returns null, and every visitor sees USD. That is the designed
degradation, not a build break.

Report exactly what you added to the Dockerfile, and confirm whether a license
key was available to you. If it was not, say so plainly — the code path is still
correct and the file can be added later.

- [ ] **Step 5: Commit**

```bash
git add lib/pricing/geo.ts lib/pricing/geo.test.ts package.json package-lock.json ../../apps/web-next/Dockerfile
git commit -m "feat: derive the visitor's country locally, never over the wire"
```

---

### Task 4: Resolve currency on the pricing page and filter the catalog

**Files:**
- Modify: `app/pricing/page.tsx`
- Modify: `components/pricing/pricing-page-content.tsx`

- [ ] **Step 1: Resolve the currency server-side**

In `app/pricing/page.tsx`, alongside the existing locale resolution:

```tsx
import { cookies, headers } from 'next/headers';
import { CURRENCY_COOKIE, resolveCurrency } from '@/lib/pricing/currency';
import { clientIpFromHeader, countryFromIp } from '@/lib/pricing/geo';

const headerList = await headers();
const cookieStore = await cookies();

const country = await countryFromIp(
  clientIpFromHeader(headerList.get('x-forwarded-for')),
);
const currency = resolveCurrency({
  cookie: cookieStore.get(CURRENCY_COOKIE)?.value ?? null,
  country,
});
```

Read the file first — it already awaits `cookies()` for the locale, so reuse
that call rather than making a second one.

- [ ] **Step 2: Filter the catalog to the active currency**

Pass `currency` into the content component and filter both lists:

```tsx
const plansInCurrency = plans.filter((plan) => plan.currency === currency);
const packsInCurrency = packs.filter((pack) => pack.currency === currency);
```

**Fallback that must not be skipped:** if `plansInCurrency` is empty — which is
exactly the state until Task 7 adds EGP rows — fall back to the USD rows rather
than rendering an empty pricing page:

```tsx
const visiblePlans = plansInCurrency.length ? plansInCurrency : plans.filter((p) => p.currency === 'USD');
```

This is what makes Tasks 1–6 safe to ship before the EGP prices exist.

- [ ] **Step 3: Test the filtering, including the empty case**

Create `lib/pricing/catalog-filter.test.ts`. Extract the filter into a pure
function in `lib/pricing/currency.ts` so it can be tested without rendering a
server component:

```ts
export function plansForCurrency<T extends { currency: string }>(
  rows: T[],
  currency: Currency,
): T[] {
  const matching = rows.filter((row) => row.currency === currency);
  /* Until EGP rows exist, an EGP visitor must still see a priced page. */
  return matching.length ? matching : rows.filter((row) => row.currency === DEFAULT_CURRENCY);
}
```

```ts
import { describe, expect, it } from 'vitest';
import { plansForCurrency } from '@/lib/pricing/currency';

const ROWS = [
  { planKey: 'launch-v1', currency: 'USD' },
  { planKey: 'dfy-v1', currency: 'USD' },
  { planKey: 'launch-v1-egp', currency: 'EGP' },
  { planKey: 'dfy-v1-egp', currency: 'EGP' },
];

describe('plansForCurrency', () => {
  it('returns only rows in the active currency', () => {
    expect(plansForCurrency(ROWS, 'EGP').map((r) => r.planKey))
      .toEqual(['launch-v1-egp', 'dfy-v1-egp']);
  });

  it('never mixes currencies in one list', () => {
    const currencies = new Set(plansForCurrency(ROWS, 'USD').map((r) => r.currency));
    expect(currencies).toEqual(new Set(['USD']));
  });

  /* The state this ships in until Task 7 runs. */
  it('falls back to USD rows when the currency has none', () => {
    const usdOnly = ROWS.filter((r) => r.currency === 'USD');
    expect(plansForCurrency(usdOnly, 'EGP').map((r) => r.planKey))
      .toEqual(['launch-v1', 'dfy-v1']);
  });

  it('returns nothing when there is nothing to return', () => {
    expect(plansForCurrency([], 'USD')).toEqual([]);
  });
});
```

Use `plansForCurrency` in the page rather than an inline `.filter`, so the
fallback lives in one tested place instead of being duplicated for plans and
packs.

Run: `npx vitest run lib/pricing/catalog-filter.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 4: Verify formatting needs no change**

`components/pricing/pricing-page-content.tsx:87` already formats with
`plan.currency` — the row's own currency, not a hardcoded one. Confirm this by
reading the line. If it is already correct, change nothing there.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new type errors, all tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/pricing/page.tsx components/pricing/pricing-page-content.tsx lib/pricing/currency.ts lib/pricing/catalog-filter.test.ts
git commit -m "feat: price the page in the visitor's currency, falling back to USD"
```

---

### Task 5: The currency switcher

**Files:**
- Create: `components/pricing/currency-toggle.tsx`
- Test: `components/pricing/currency-toggle.test.tsx`
- Modify: `components/pricing/pricing-page-content.tsx` (render it near the plan grid)

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CurrencyToggle } from '@/components/pricing/currency-toggle';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

describe('CurrencyToggle', () => {
  it('offers the other currency', () => {
    render(<CurrencyToggle currency="USD" locale="en" />);
    expect(screen.getByRole('button', { name: /EGP/ })).toBeInTheDocument();
  });

  it('writes the cookie when clicked', () => {
    render(<CurrencyToggle currency="USD" locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: /EGP/ }));
    expect(document.cookie).toContain('gc-currency=EGP');
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run components/pricing/currency-toggle.test.tsx`
Expected: FAIL — unresolved import

- [ ] **Step 3: Write the component**

```tsx
'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CURRENCY_COOKIE, type Currency } from '@/lib/pricing/currency';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* Always visible, not only when detection fails. IP lookup is wrong for VPN
   users, travellers and expats by nature, and a pricing page is the worst place
   to make someone doubt what they are reading. Follows DashboardLocaleToggle:
   the price is resolved server-side, so flipping the cookie needs a refresh. */
export function CurrencyToggle({
  currency,
  locale,
}: {
  currency: Currency;
  locale: SiteLocale;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const next: Currency = currency === 'EGP' ? 'USD' : 'EGP';
  const label = locale === 'ar' ? `عرض الأسعار بـ ${next}` : `Show prices in ${next}`;

  function toggle() {
    document.cookie = `${CURRENCY_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      className="min-h-11 rounded-full px-3 text-xs font-semibold"
    >
      {label}
    </Button>
  );
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run components/pricing/currency-toggle.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 5: Render it**

Place it directly above the plan grid in
`components/pricing/pricing-page-content.tsx`, near `sortedPlans.map` at around
line 282, so it sits where the prices are rather than in a page header a reader
has already scrolled past.

- [ ] **Step 6: Commit**

```bash
git add components/pricing/currency-toggle.tsx components/pricing/currency-toggle.test.tsx components/pricing/pricing-page-content.tsx
git commit -m "feat: let the visitor correct the currency guess in one click"
```

---

### Task 6: The Shopify panel uses the shop's country

The Shopify panel does not need to guess — Shopify knows the shop's country
exactly.

**Files:**
- Modify: `components/shopify/admin-settings.tsx`
- Possibly modify: whatever loads the Shopify session or shop record

- [ ] **Step 1: Find out whether the country is already available**

Search for where the shop record or Shopify session is loaded and whether it
carries a country field.

If it does, use it: `resolveCurrency({ cookie: null, country: shop.country })`.

If it does NOT, STOP and report. Fetching it means an additional Shopify API
call, which is a real change to that integration and deserves its own decision
rather than being smuggled into this task.

- [ ] **Step 2: Apply it to the plan card**

Whatever price the merchant plan card shows should use the resolved currency,
consistent with the pricing page.

- [ ] **Step 3: Verify**

Run: `npx vitest run components/shopify && npx tsc --noEmit`
Expected: passing, no new type errors.

- [ ] **Step 4: Commit**

```bash
git add components/shopify/admin-settings.tsx
git commit -m "feat: price the Shopify panel from the shop's own country"
```

---

### Task 7: EGP catalog rows — BLOCKED on owner prices

**Do not invent prices.** If the owner has not supplied them, stop here, commit
Tasks 1–6, and report that this task is waiting. The fallback in Task 4 Step 2
means everything shipped so far behaves correctly with no EGP rows present.

**Files:**
- Create: a migration adding three catalog rows

- [ ] **Step 1: Confirm the table shape**

Read `lib/try-on/public-catalog.ts:161` for the exact column list the app selects:
`plan_key, name, description, price_minor, currency, renders_included, model_key, is_free, sort_order`.

Match the existing USD rows for every column except `plan_key`, `currency` and
`price_minor`.

- [ ] **Step 2: Write the migration**

```sql
-- EGP catalog rows. Prices are set by the owner, not converted: PLANS.md
-- computes margins against USD provider costs and treats rows as immutable once
-- a subscription references them, so a drifting converted price would both
-- contradict that and hide margin erosion when EGP moves.
insert into <catalog_table> (plan_key, name, description, price_minor, currency, renders_included, model_key, is_free, sort_order)
values
  ('free-v1-egp',   <name>, <description>, 0,             'EGP', 20,  'lite',  true,  <sort>),
  ('launch-v1-egp', <name>, <description>, <OWNER_PRICE>, 'EGP', 300, 'lite',  false, <sort>),
  ('dfy-v1-egp',    <name>, <description>, <OWNER_PRICE>, 'EGP', 450, 'flash', false, <sort>);
```

`price_minor` is minor units — 74900 is 749.00 EGP.

`renders_included` and `model_key` must match the USD rows exactly. The plan does
not change between currencies; only what it costs does.

- [ ] **Step 3: Verify copy resolution needs no change**

`getPlanCopyKey()` maps `launch-*` to `launch-v1`, so `launch-v1-egp` inherits the
Arabic name from Task 1 automatically. Confirm by reading the function rather than
assuming.

- [ ] **Step 4: Apply and verify**

Apply the migration, then load `/pricing` with the `gc-currency` cookie set to
`EGP` and confirm three plans render with EGP prices and Arabic names in Arabic.

- [ ] **Step 5: Commit**

```bash
git add <migration path>
git commit -m "feat: EGP catalog rows at owner-set prices"
```

---

### Task 8: Final verification

- [ ] **Step 1: Full suite, typecheck, lint**

```bash
npx vitest run && npx tsc --noEmit && npx eslint .
```

Expected: all passing apart from the three pre-existing
`install-page-content.test.tsx` readonly-array errors.

- [ ] **Step 2: Check all four currency paths in a browser**

Start the dev server through the preview tooling. For each case, confirm what
renders:

| Cookie | Expectation |
|---|---|
| none | USD (no GeoLite2 data locally, so no country resolves) |
| `gc-currency=EGP` | EGP rows if they exist, USD rows if Task 7 is still blocked |
| `gc-currency=USD` | USD, even though a country might say otherwise |
| `gc-currency=BTC` | USD — an unrecognised value is ignored, not trusted |

- [ ] **Step 3: Confirm Arabic plan names render**

Set `gc-locale=ar`, load `/pricing`, confirm the plans read مجاني, انطلاق and
خدمة كاملة rather than English.

- [ ] **Step 4: Report the blocked state honestly**

If Task 7 did not run, say so in the summary. A plan reported complete with a
task silently skipped is worse than one reported blocked.
