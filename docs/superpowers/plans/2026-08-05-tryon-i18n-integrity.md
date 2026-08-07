# Try-on i18n Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the try-on dashboard surface fully Arabic when the locale is Arabic, and add a gate so untranslated copy cannot be added to that surface again.

**Architecture:** All try-on dashboard copy moves into one typed module with two dictionaries, so TypeScript makes an English-only key a compile error. A gate covers the remaining risk — that a string bypasses the dictionary entirely — in two parts, because the surface is two kinds of code: the client panel gets a real Arabic render assertion, and the server page (async, behind Clerk auth, unrenderable in vitest) gets a scoped source scan.

**Tech Stack:** Next 15.5 App Router, React 19, TypeScript, Vitest 3.2.4 + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-08-05-dashboard-i18n-parity-design.md`

**Branch:** create `feat/tryon-i18n-integrity` off `main` before Task 1. Do not work on `main`.

**Working directory:** all paths are relative to `apps/web-next` unless stated otherwise.

---

## Conventions

Tests are Vitest with Testing Library and the `@/` alias:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
```

Run one file: `npx vitest run <path>`
Run everything: `npx vitest run` — baseline is **83 files / 276 tests**, all passing. It must stay green.

The existing `lib/try-on/settings-copy.ts` is the pattern to copy. Its shape:

- `export interface SettingsFormCopy` (line 14)
- `const en: SettingsFormCopy` (line 75)
- `const ar: SettingsFormCopy` (line 138)
- `export function getSettingsFormCopy(locale: TryOnLocale): SettingsFormCopy` (line 199)

Arabic is Modern Standard Arabic throughout this codebase. Match that register.

---

### Task 1: The copy module

**Files:**
- Create: `lib/try-on/dashboard-copy.ts`
- Test: `lib/try-on/dashboard-copy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { getTryOnDashboardCopy, type TryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';

/* Types already guarantee both dictionaries satisfy the interface at build
   time. This catches the case types cannot: a dictionary assembled or spread
   at runtime that silently drops a key. */
describe('getTryOnDashboardCopy', () => {
  it('returns Arabic for ar and English for en', () => {
    expect(getTryOnDashboardCopy('ar').merchantShops).toBe('متاجر التجار');
    expect(getTryOnDashboardCopy('en').merchantShops).toBe('Merchant shops');
  });

  it('exposes the same key set in both languages', () => {
    const en = Object.keys(getTryOnDashboardCopy('en')).sort();
    const ar = Object.keys(getTryOnDashboardCopy('ar')).sort();
    expect(ar).toEqual(en);
  });

  /* The whole point of the module: no English may survive into the Arabic
     dictionary. Latin letters here mean somebody pasted the English value. */
  it('has no Latin letters anywhere in the Arabic dictionary', () => {
    const values = Object.values(getTryOnDashboardCopy('ar')) as string[];
    for (const value of values) {
      expect(value, `Latin text in Arabic copy: ${value}`).not.toMatch(/[A-Za-z]/);
    }
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run lib/try-on/dashboard-copy.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/try-on/dashboard-copy"`

- [ ] **Step 3: Write the module**

```ts
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* Copy for the try-on dashboard page and its settings panel.

   Separate from settings-copy.ts on purpose: that module is shared with the
   Shopify embedded admin and must stay limited to the controls both surfaces
   render. This one is the dashboard's own scaffolding, which Shopify does not
   have. */
export interface TryOnDashboardCopy {
  installedShops: string;
  recentGenerations: string;
  avgGenerationTime: string;
  noDataYet: string;
  providerSpend: string;

  merchantShops: string;
  merchantShopsBody: string;
  columnShop: string;
  columnStatus: string;
  columnGenerations: string;
  columnLastGeneration: string;

  planAndCredits: string;
  planAndCreditsBody: string;

  appearance: string;
  appearanceBody: string;

  editing: string;
}

const en: TryOnDashboardCopy = {
  installedShops: 'Installed shops',
  recentGenerations: 'Recent generations',
  avgGenerationTime: 'Avg generation time',
  noDataYet: 'No data yet',
  providerSpend: 'Provider spend (recent)',

  merchantShops: 'Merchant shops',
  merchantShopsBody:
    'A shop appears the first time its admin opens the app, and drops to uninstalled when Shopify tells us it was removed.',
  columnShop: 'Shop',
  columnStatus: 'Status',
  columnGenerations: 'Generations',
  columnLastGeneration: 'Last generation',

  planAndCredits: 'Plan and credits',
  planAndCreditsBody:
    'Payment is collected outside the app, so activating here is what grants credits. Every action is recorded in the ledger with its payment reference.',

  appearance: 'Appearance and journey',
  appearanceBody:
    'The same controls the merchant sees in their Shopify admin, writing to the same record. Changes go live within a minute.',

  editing: 'Editing',
};

const ar: TryOnDashboardCopy = {
  installedShops: 'المتاجر المثبَّتة',
  recentGenerations: 'أحدث عمليات التوليد',
  avgGenerationTime: 'متوسط زمن التوليد',
  noDataYet: 'لا توجد بيانات بعد',
  providerSpend: 'تكلفة المزود (حديثًا)',

  merchantShops: 'متاجر التجار',
  merchantShopsBody:
    'يظهر المتجر أول مرة يفتح فيها مسؤوله التطبيق، ويتحول إلى غير مثبَّت عندما تخبرنا شوبيفاي بإزالته.',
  columnShop: 'المتجر',
  columnStatus: 'الحالة',
  columnGenerations: 'عمليات التوليد',
  columnLastGeneration: 'آخر عملية توليد',

  planAndCredits: 'الخطة والأرصدة',
  planAndCreditsBody:
    'يتم تحصيل الدفع خارج التطبيق، لذا فإن التفعيل من هنا هو ما يمنح الأرصدة. كل إجراء يُسجَّل في السجل مع مرجع الدفع الخاص به.',

  appearance: 'المظهر ورحلة العميل',
  appearanceBody:
    'نفس عناصر التحكم التي يراها التاجر في لوحة شوبيفاي، وتكتب في السجل نفسه. تظهر التغييرات خلال دقيقة.',

  editing: 'التعديل على',
};

export function getTryOnDashboardCopy(locale: SiteLocale): TryOnDashboardCopy {
  return locale === 'ar' ? ar : en;
}
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npx vitest run lib/try-on/dashboard-copy.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add lib/try-on/dashboard-copy.ts lib/try-on/dashboard-copy.test.ts
git commit -m "feat: one place for try-on dashboard copy, in both languages"
```

---

### Task 2: Use the copy on the try-on page

**Files:**
- Modify: `app/dashboard/try-on/page.tsx`

- [ ] **Step 1: Read the whole file first**

Do not work from the list below alone. Open the file and find every user-facing
string literal in it, including any this plan did not enumerate — an empty-state
message, a status badge label, a date fallback. The known ones are at
approximately lines 53–59 (the `kpis` array), 79–83, 95–98, 124–128 and 142–146.

If you find literals beyond those, add keys for them to
`lib/try-on/dashboard-copy.ts` in BOTH dictionaries and report what you added.
Do not leave one behind because it was not in this plan.

- [ ] **Step 2: Resolve copy at the top of the component**

The page already imports `getRequestLocale` at line 12 and awaits a locale. Add:

```tsx
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';
```

and inside the component, after the locale is resolved:

```tsx
const c = getTryOnDashboardCopy(locale);
```

Match the existing variable naming — `settings-controls.tsx` and
`admin-settings.tsx` both use `c` for resolved copy.

- [ ] **Step 3: Replace every literal**

The `kpis` array becomes:

```tsx
  const kpis = [
    { label: c.installedShops, value: String(installed.length) },
    { label: c.recentGenerations, value: String(jobs.length) },
    {
      label: c.avgGenerationTime,
      value: completed.length ? `${avgSeconds.toFixed(1)}s` : c.noDataYet,
    },
    { label: c.providerSpend, value: `$${totalCost.toFixed(2)}` },
  ];
```

Note `key={kpi.label}` further down still works — the label is still unique
within the array in either language.

The card headings and table headers become:

```tsx
<CardTitle>{c.merchantShops}</CardTitle>
<CardDescription>{c.merchantShopsBody}</CardDescription>
```
```tsx
<TableHead>{c.columnShop}</TableHead>
<TableHead>{c.columnStatus}</TableHead>
<TableHead className="text-end">{c.columnGenerations}</TableHead>
<TableHead>{c.columnLastGeneration}</TableHead>
```
```tsx
<CardTitle>{c.planAndCredits}</CardTitle>
<CardDescription>{c.planAndCreditsBody}</CardDescription>
```
```tsx
<CardTitle>{c.appearance}</CardTitle>
<CardDescription>{c.appearanceBody}</CardDescription>
```

Leave `shop.domain` alone — a myshopify domain is an identifier, not copy.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: only the three pre-existing errors in
`components/dashboard/install-page-content.test.tsx` about readonly arrays.
Those predate this branch. Anything else is yours.

Run: `npx vitest run`
Expected: 83 files / 276 tests passing.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/try-on/page.tsx lib/try-on/dashboard-copy.ts
git commit -m "feat: translate the try-on page instead of ignoring its own locale"
```

---

### Task 3: Use the copy in the settings panel

**Files:**
- Modify: `components/dashboard/tryon-settings-panel.tsx` (the `Editing` label, around line 95)

- [ ] **Step 1: Replace the hardcoded label**

Currently:

```tsx
<Label htmlFor="shop_select">Editing</Label>
```

Becomes:

```tsx
<Label htmlFor="shop_select">{c.editing}</Label>
```

The component already receives `locale` as a prop (it passes it to
`TryOnSettingsControls` at line 121). Resolve copy alongside that:

```tsx
import { getTryOnDashboardCopy } from '@/lib/try-on/dashboard-copy';

const c = getTryOnDashboardCopy(locale);
```

- [ ] **Step 2: Sweep this file too**

Read the whole component and translate any other user-facing literal you find —
button labels, status text, `aria-label` and `placeholder` props. Add keys in
both dictionaries for anything new and report it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new type errors, 276 tests passing.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/tryon-settings-panel.tsx lib/try-on/dashboard-copy.ts
git commit -m "feat: translate the settings panel chrome"
```

---

### Task 4: The gate, part one — Arabic render assertion

This is the strong half of the gate. It renders the panel in Arabic and fails on
Latin text, so it catches strings arriving through props, through third-party
components, or by concatenation — none of which a source scan sees reliably.

**Files:**
- Create: `components/dashboard/tryon-settings-panel.i18n.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TryOnSettingsPanel } from '@/components/dashboard/tryon-settings-panel';

/* Text that is legitimately Latin inside an Arabic UI. Each entry needs a
   reason — an allowlist nobody justifies becomes a way to smuggle English in.

   Plan names are deliberately absent: they translate, so an untranslated one
   must fail here rather than pass as permitted Latin. */
const ALLOWED = [
  /^GRINDCTRL$/i,          // brand mark, never translated
  /\.myshopify\.com$/,      // shop identifiers
  /^[\d\s.,:%$+\-—/()]+$/,  // numbers, units, punctuation
];

function isAllowed(text: string): boolean {
  return ALLOWED.some((pattern) => pattern.test(text.trim()));
}

describe('TryOnSettingsPanel in Arabic', () => {
  it('renders no un-allowlisted Latin text', () => {
    const { container } = render(
      <TryOnSettingsPanel
        locale="ar"
        {...(getPanelFixtureProps() as Record<string, unknown>)}
      />,
    );

    const offenders: string[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      if (!text || !/[A-Za-z]/.test(text)) continue;
      if (!isAllowed(text)) offenders.push(text);
    }

    expect(offenders, `Untranslated text in Arabic UI: ${offenders.join(' | ')}`)
      .toEqual([]);
  });
});
```

- [ ] **Step 2: Write `getPanelFixtureProps`**

`TryOnSettingsPanel` takes real props. Read its prop type, then write a fixture
in the SAME test file returning a minimal valid object — a settings record, a
shop list with one `example.myshopify.com` entry, and whatever else the type
requires. Do not use `as any` to dodge the type; if the props are awkward to
construct, that is worth reporting as a design smell.

- [ ] **Step 3: Run it**

Run: `npx vitest run components/dashboard/tryon-settings-panel.i18n.test.tsx`

If it FAILS, read the offenders it lists. Each is either a real untranslated
string — translate it via Task 1's module — or legitimately Latin, in which case
add an allowlist entry WITH a comment saying why.

Do not widen the allowlist to make the test pass without deciding which case
each offender is. That is the one way this gate becomes worthless.

- [ ] **Step 4: Verify the gate can fail**

Temporarily add a hardcoded `<span>Hardcoded English</span>` to the panel, re-run
the test, and confirm it fails naming that string. Then remove it. A gate you
have not seen fail is not known to work.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/tryon-settings-panel.i18n.test.tsx
git commit -m "test: fail the build when English survives into the Arabic panel"
```

---

### Task 5: The gate, part two — scoped source scan

`app/dashboard/try-on/page.tsx` is an async server component behind Clerk auth.
Testing Library cannot render it and no signed-in Playwright session is
automated in this project, so this half scans source instead.

**Files:**
- Create: `app/dashboard/try-on/page.i18n.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/* Deliberately watches ONE file. A gate that reports 159 findings across the
   whole dashboard on day one gets switched off; this one can be widened a page
   at a time by adding a path here, which keeps each expansion reviewable. */
const WATCHED = 'app/dashboard/try-on/page.tsx';

/* JSX text children: >Some English<  */
const JSX_TEXT = />\s*[A-Z][A-Za-z]*(?:\s+[A-Za-z]+){1,}\s*</g;

/* User-facing string props. className/href/id are excluded — they are not copy. */
const COPY_PROPS = /\b(?:aria-label|placeholder|title|alt)\s*=\s*"([^"]{2,})"/g;

describe(`${WATCHED} holds no hardcoded copy`, () => {
  it('has no English JSX text children', async () => {
    const source = await readFile(WATCHED, 'utf8');
    const found = [...source.matchAll(JSX_TEXT)].map((m) => m[0].trim());

    expect(found, `Hardcoded JSX text: ${found.join(' | ')}`).toEqual([]);
  });

  it('has no hardcoded user-facing string props', async () => {
    const source = await readFile(WATCHED, 'utf8');
    const found = [...source.matchAll(COPY_PROPS)].map((m) => m[1]);

    expect(found, `Hardcoded copy props: ${found.join(' | ')}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run app/dashboard/try-on/page.i18n.test.ts`
Expected: PASS, because Task 2 already moved this file's copy into the module.

If it fails, Task 2 missed a literal. Translate it rather than loosening the
regex.

- [ ] **Step 3: Confirm the relative path resolves**

The test reads `app/dashboard/try-on/page.tsx` relative to the vitest working
directory. If it throws ENOENT, build the path from `import.meta.url` instead of
abandoning the check.

- [ ] **Step 4: Verify the gate can fail**

Temporarily add `<p>Temporary English text</p>` to the page, re-run, confirm it
fails naming that text, then remove it.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/try-on/page.i18n.test.ts
git commit -m "test: keep hardcoded copy out of the try-on page"
```

---

### Task 6: The parity audit

A document. No code changes.

**Files:**
- Create: `docs/audits/2026-08-05-tryon-settings-parity.md`

- [ ] **Step 1: Inventory both surfaces**

Read `components/dashboard/tryon-settings-panel.tsx` and
`components/shopify/admin-settings.tsx` in full, plus the shared
`components/try-on/settings-controls.tsx`.

For every control, card and action on either surface, record: what it is, which
surface has it, and whether it writes to the same record.

- [ ] **Step 2: Write the document**

Structure:

```markdown
# Try-on settings: dashboard vs Shopify panel

Date: 5 August 2026
Status: audit only — no code changed

## Summary

[Two or three sentences: what is shared, what diverges, and whether the
divergence looks deliberate.]

## Control inventory

| Control | Dashboard | Shopify panel | Same record? | Verdict |
|---|---|---|---|---|
| ... | yes/no | yes/no | yes/no | same / dashboard-only / Shopify-only |

## Divergences, with a recommendation each

### [Name of divergence]
**What differs:** ...
**Why it probably differs:** ...
**Recommendation:** converge / keep apart deliberately / needs a product decision
```

Two findings are already established and must appear:

- Both surfaces render the same `TryOnSettingsControls` with the same `locale`,
  so the settings a merchant actually chooses are identical. The divergence is
  entirely in the surrounding scaffolding.
- The Shopify panel is wrapped in `max-w-3xl` at `components/shopify/admin-settings.tsx:129`.
  That is exactly 48rem, the container-query threshold used by
  `settings-controls.tsx`, so the two-column preview layout can never engage in
  Shopify regardless of screen size. The preview always scrolls there. This is
  currently a safe outcome rather than a bug, but it is accidental — nobody chose
  48rem in both places on purpose.

- [ ] **Step 3: Commit**

```bash
git add docs/audits/2026-08-05-tryon-settings-parity.md
git commit -m "docs: audit try-on settings parity across the two surfaces"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: 83 files plus the new ones, zero failures.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint .`
Expected: clean apart from the three pre-existing `install-page-content.test.tsx`
errors.

- [ ] **Step 3: Look at it in Arabic**

Start the dev server through the preview tooling, not a bare shell command. Set
the `gc-locale` cookie to `ar`, load `/dashboard/try-on`, and read the page.
Confirm no English remains outside shop domains and numbers.

Report anything the automated gate missed — that is a gap in the gate worth
recording, not just a string to fix.

- [ ] **Step 4: Confirm the tree is clean**

```bash
git status
```

Unrelated pre-existing changes (`.mcp.json`, `apps/clerk-mcp/`, the tryon docs)
must remain uncommitted and untouched.
