# Landing, Mobile and Pinned-Preview Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six confirmed defects — mobile top bar, mobile text overflow, ambiguous step markers, abstract step icons, an undiscoverable try-on slider, and a pinned preview that hides the controls beneath it.

**Architecture:** Three new shared components (`Eyebrow`, `StepMarker`, `TryOnRevealFigure`) replace repeated inline markup, so each defect is fixed once at its source rather than at each call site. `SiteHeader` is extracted from a 35KB file and gains a mobile menu built on the existing `components/ui/sheet.tsx`. The pinned preview moves from viewport breakpoints to container queries because one of its two mounts is a Shopify iframe where viewport units describe the wrong box.

**Tech Stack:** Next 15.4 (App Router), React 19, Tailwind 4.1.11 (container queries built in, no plugin), Radix via `components/ui/sheet.tsx`, HugeIcons + Lucide, Vitest 3.2.4 + @testing-library/react, Playwright.

**Branch:** `feat/landing-mobile-overhaul` (already created, spec committed as `f735db0`)

**Working directory:** all paths below are relative to `apps/web-next` unless stated otherwise.

---

## Conventions used by every task

Tests are Vitest with Testing Library, using the `@/` path alias:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
```

Run a single test file:

```bash
npx vitest run components/landing/eyebrow.test.tsx
```

Run the whole suite (baseline: 78 files, 261 tests, all passing — this must stay true):

```bash
npx vitest run
```

`SiteLocale` is `'en' | 'ar'` and is imported as a type from `@/lib/landing/landing-i18n`.

---

### Task 1: `Eyebrow` component — the overflow root cause

The declaration `text-[11px] font-semibold uppercase tracking-[0.22em]` appears about twelve times across five files. Wide letter-spacing on uppercase text overflows at 320px. In Arabic it is also incorrect: `tracking` breaks cursive letter-joining, making the text both visually broken and wider. This component becomes the single definition.

**Files:**
- Create: `components/landing/eyebrow.tsx`
- Test: `components/landing/eyebrow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Eyebrow } from '@/components/landing/eyebrow';

describe('Eyebrow', () => {
  it('uses uppercase and wide tracking in English', () => {
    render(<Eyebrow locale="en">How it works</Eyebrow>);

    const el = screen.getByText('How it works');
    expect(el.className).toContain('uppercase');
    expect(el.className).toContain('tracking-[0.16em]');
  });

  /* Arabic is cursive. Letter-spacing breaks the joins between glyphs and
     inflates the measured width, which is what pushed these strings past the
     viewport at 320px. Uppercase is meaningless for Arabic script. */
  it('drops uppercase and tracking in Arabic', () => {
    render(<Eyebrow locale="ar">كيف تعمل</Eyebrow>);

    const el = screen.getByText('كيف تعمل');
    expect(el.className).not.toContain('uppercase');
    expect(el.className).not.toContain('tracking-');
  });

  it('allows callers to add classes without losing the base ones', () => {
    render(<Eyebrow locale="en" className="mb-4">Pricing</Eyebrow>);

    const el = screen.getByText('Pricing');
    expect(el.className).toContain('mb-4');
    expect(el.className).toContain('text-muted-foreground');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/landing/eyebrow.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/landing/eyebrow"`

- [ ] **Step 3: Write the minimal implementation**

```tsx
import React from 'react';
import { cn } from '@/lib/utils';
import type { SiteLocale } from '@/lib/landing/landing-i18n';

/* The small label above a section heading. Centralised because the inline
   version was repeated ~12 times across 5 files, and the Arabic case needs
   different typography rather than the same classes with a different string. */
export function Eyebrow({
  locale,
  className,
  children,
}: {
  locale: SiteLocale;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold text-muted-foreground',
        /* Tracking reduced from 0.22em to 0.16em even in English: the original
           value overflowed at 320px on the longest labels. */
        locale === 'ar' ? 'text-xs' : 'uppercase tracking-[0.16em]',
        className,
      )}
    >
      {children}
    </p>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/landing/eyebrow.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add components/landing/eyebrow.tsx components/landing/eyebrow.test.tsx
git commit -m "feat: one eyebrow component, with Arabic typography that fits"
```

---

### Task 2: Replace every inline eyebrow with the component

**Files:**
- Modify: `components/landing/site-landing.tsx` (lines 95, 440, 530, 537, 615, 693, 728)
- Modify: `components/landing/landing-after-playground-sections.tsx` (lines 121, 329)
- Modify: `components/landing/trial-path-card.tsx` (lines 16, 34)
- Modify: `components/landing/try-on-agent-showcase.tsx` (lines 97, 134)
- Modify: `components/landing/hero-workflow-preview.tsx` (lines 84, 98)

- [ ] **Step 1: Confirm the exact call sites before editing**

```bash
npx --no-install rg -n "text-\[11px\] font-semibold uppercase tracking-" components/landing
```

Expected: the line numbers listed above. If they differ, the file has moved on — use the output, not this list.

- [ ] **Step 2: Replace each occurrence**

Each site currently looks like this:

```tsx
<p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
  {t.howEyebrow}
</p>
```

Becomes:

```tsx
<Eyebrow locale={locale}>{t.howEyebrow}</Eyebrow>
```

Add to each file's imports:

```tsx
import { Eyebrow } from '@/components/landing/eyebrow';
```

Where a component does not already have `locale` in scope, take it from the landing locale context rather than threading a new prop through:

```tsx
import { useLandingLocale } from '@/components/landing/landing-locale';

const { locale } = useLandingLocale();
```

Note `trial-path-card.tsx:34` uses `tracking-[0.16em]` and `try-on-agent-showcase.tsx:134` uses `text-[12px]`. Both still become `<Eyebrow>` — the point is one definition, not preserving three near-identical variants.

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: 78 files, 261 tests, all passing. Any failure here is a real regression from the swap, not a flake — fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add components/landing
git commit -m "refactor: route every eyebrow through the shared component"
```

---

### Task 3: `StepMarker` — charcoal tile, cream icon, ghost numeral

**Files:**
- Create: `components/landing/step-marker.tsx`
- Test: `components/landing/step-marker.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Shirt } from 'lucide-react';
import { StepMarker } from '@/components/landing/step-marker';

describe('StepMarker', () => {
  it('renders the step number as two digits', () => {
    render(<StepMarker index={0} icon={Shirt} />);
    expect(screen.getByText('01')).toBeInTheDocument();
  });

  it('counts from one, not zero', () => {
    render(<StepMarker index={2} icon={Shirt} />);
    expect(screen.getByText('03')).toBeInTheDocument();
  });

  /* The numeral is decorative — the ordered list already conveys sequence to
     assistive tech, so announcing "01" again is noise. */
  it('hides the decorative numeral from assistive technology', () => {
    const { container } = render(<StepMarker index={0} icon={Shirt} />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/landing/step-marker.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/landing/step-marker"`

- [ ] **Step 3: Write the minimal implementation**

```tsx
import React from 'react';
import type { LucideIcon } from 'lucide-react';

/* Was three copies of a hairline ring plus a detached number. The ring sat
   almost the same colour as the page, so the icon had no ground and the number
   read as a second, unrelated mark. One solid tile, one numeral behind it. */
export function StepMarker({
  index,
  icon: IconComponent,
}: {
  index: number;
  icon: LucideIcon;
}) {
  const label = String(index + 1).padStart(2, '0');

  return (
    <span className="relative inline-flex">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 start-0 select-none text-[64px] font-extrabold leading-none tracking-tight text-foreground/[0.07]"
      >
        {label}
      </span>
      <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-foreground text-background">
        <IconComponent className="size-6" strokeWidth={1.7} aria-hidden="true" />
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/landing/step-marker.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add components/landing/step-marker.tsx components/landing/step-marker.test.tsx
git commit -m "feat: step marker that reads as one mark instead of two"
```

---

### Task 4: Literal step icons, wired into "how it works"

The current icons are `ClothesIcon`, `ImageUploadIcon`, `ShoppingBagCheckIcon` from HugeIcons — abstract shapes. Lucide is already installed and ships literal equivalents at a consistent 24px grid and stroke weight, which is the stated preference order in the spec: library first, custom SVG only where nothing depicts the subject plainly.

**Files:**
- Modify: `components/landing/site-landing.tsx:28` (the `stepIcons` array) and `:452-470` (the `<ol>`)

- [ ] **Step 1: Replace the icon array**

Remove `ClothesIcon`, `ImageUploadIcon`, `ShoppingBagCheckIcon` from the `@hugeicons/core-free-icons` import block at lines 6–12, leaving any other icons that block imports. Then replace line 28:

```tsx
const stepIcons = [ClothesIcon, ImageUploadIcon, ShoppingBagCheckIcon];
```

with:

```tsx
import { Shirt, ImageUp, ShoppingBag } from 'lucide-react';

/* Literal depictions of each step: an actual garment, an actual photo upload,
   an actual bag. Same family so stroke weight stays consistent across all
   three — mixing weights is how this treatment falls apart. */
const stepIcons = [Shirt, ImageUp, ShoppingBag];
```

- [ ] **Step 2: Use `StepMarker` in the list**

Replace the marker block at lines 458–465:

```tsx
<div className="absolute start-0 top-0 flex flex-col items-center gap-2 md:w-full md:flex-row md:justify-between md:gap-3">
  <span className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background shadow-sm">
    <Icon icon={stepIcons[i] ?? ClothesIcon} size={20} />
  </span>
  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
    {String(i + 1).padStart(2, '0')}
  </span>
</div>
```

with:

```tsx
<div className="absolute start-0 top-0">
  <StepMarker index={i} icon={stepIcons[i] ?? Shirt} />
</div>
```

Add the import:

```tsx
import { StepMarker } from '@/components/landing/step-marker';
```

- [ ] **Step 3: Run the suite**

Run: `npx vitest run`
Expected: 261 passing. If `Icon` from `@/components/icons` is now unused in this file, remove the import — an unused import fails lint.

- [ ] **Step 4: Commit**

```bash
git add components/landing/site-landing.tsx
git commit -m "feat: literal step icons, one mark per step"
```

---

### Task 5: Remove the slider strings, add the animation strings

Doing the i18n first means the next task's component has real strings to consume, and a missed key surfaces as a TypeScript error rather than a runtime gap.

**Files:**
- Modify: `lib/landing/landing-i18n.ts` (interface at 49–51, English at 153–155, Arabic at 326–328)

- [ ] **Step 1: Update the interface**

Replace lines 49–51:

```ts
  heroSliderLabel: string;
  heroSliderHint: string;
  heroSliderValue: (value: number) => string;
```

with:

```ts
  heroRevealCaption: string;
  heroRevealAlt: string;
```

- [ ] **Step 2: Update the English dictionary**

Replace lines 153–155 with:

```ts
  heroRevealCaption: 'See it on before you buy',
  heroRevealAlt:
    'A cream ringer T-shirt appears on a shopper, showing how the garment looks when worn.',
```

- [ ] **Step 3: Update the Arabic dictionary**

Replace lines 326–328 with:

```ts
  heroRevealCaption: 'شوفها عليك قبل ما تشتري',
  heroRevealAlt: 'تيشيرت رينجر كريمي يظهر على العميل ليوضح شكل القطعة أثناء ارتدائها.',
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in `site-landing.tsx` where the removed keys are still referenced. Those are fixed in Task 7 — that is the intended signal, not a problem.

- [ ] **Step 5: Commit**

```bash
git add lib/landing/landing-i18n.ts
git commit -m "feat: swap the slider strings for the reveal animation's"
```

---

### Task 6: `TryOnRevealFigure` — the CSS-keyframe animation

**Files:**
- Create: `components/landing/try-on-reveal-figure.tsx`
- Test: `components/landing/try-on-reveal-figure.test.tsx`
- Modify: `app/globals.css` (append the keyframes)

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TryOnRevealFigure } from '@/components/landing/try-on-reveal-figure';

describe('TryOnRevealFigure', () => {
  /* The animation replaced an interactive slider. Nothing is operable now, so
     the message has to survive entirely without motion — this is the whole
     accessibility argument for making it passive. */
  it('states the outcome in text for assistive technology', () => {
    render(
      <TryOnRevealFigure
        caption="See it on before you buy"
        alt="A cream ringer T-shirt appears on a shopper."
        productSrc="/try-on/mock-product.png"
        resultSrc="/try-on/mock-result.png"
      />,
    );

    expect(
      screen.getByRole('figure', { name: /cream ringer t-shirt appears on a shopper/i }),
    ).toBeInTheDocument();
  });

  it('shows the caption', () => {
    render(
      <TryOnRevealFigure
        caption="See it on before you buy"
        alt="A cream ringer T-shirt appears on a shopper."
        productSrc="/try-on/mock-product.png"
        resultSrc="/try-on/mock-result.png"
      />,
    );

    expect(screen.getByText('See it on before you buy')).toBeInTheDocument();
  });

  /* The decorative layers must not be announced twice — the figure's own
     accessible name already carries the message. */
  it('marks the image layers decorative', () => {
    const { container } = render(
      <TryOnRevealFigure
        caption="See it on before you buy"
        alt="A cream ringer T-shirt appears on a shopper."
        productSrc="/try-on/mock-product.png"
        resultSrc="/try-on/mock-result.png"
      />,
    );

    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('alt')).toBe('');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/landing/try-on-reveal-figure.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/landing/try-on-reveal-figure"`

- [ ] **Step 3: Add the keyframes to `app/globals.css`**

Append at the end of the file:

```css
/* Try-on reveal. Passive by design: the previous slider was only discoverable
   by dragging a handle, so most visitors never saw the result at all. Pure
   keyframes — nothing on the main thread, no library. */
@keyframes gc-tryon-garment {
  0%, 6%    { transform: translate(-58%, 6%) scale(.62) rotate(-8deg); opacity: 0; }
  16%       { opacity: 1; }
  38%, 100% { transform: none; opacity: 1; }
}

@keyframes gc-tryon-reveal {
  0%, 36%   { clip-path: inset(0 100% 0 0); }
  54%, 88%  { clip-path: inset(0 0 0 0); }
  97%, 100% { clip-path: inset(0 100% 0 0); }
}

@keyframes gc-tryon-caption {
  0%, 44%   { opacity: 0; transform: translateY(6px); }
  58%, 88%  { opacity: 1; transform: none; }
  96%, 100% { opacity: 0; }
}

.gc-tryon-garment { animation: gc-tryon-garment 6.5s cubic-bezier(.6,0,.3,1) infinite; }
.gc-tryon-reveal  { animation: gc-tryon-reveal 6.5s cubic-bezier(.65,0,.35,1) infinite; }
.gc-tryon-caption { animation: gc-tryon-caption 6.5s ease-out infinite; }

/* Settle on the finished state rather than freezing mid-wipe — a reduced-motion
   visitor should see the result, which is the point of the section. */
@media (prefers-reduced-motion: reduce) {
  .gc-tryon-garment,
  .gc-tryon-reveal,
  .gc-tryon-caption { animation: none !important; }
  .gc-tryon-reveal  { clip-path: inset(0 0 0 0); }
  .gc-tryon-caption { opacity: 1; transform: none; }
}
```

Note: the RTL direction of the wipe is handled in Task 7 by flipping the clip via a direction-aware class, not here.

- [ ] **Step 4: Write the component**

```tsx
import React from 'react';
import Image from 'next/image';

/* Replaces BeforeAfterSlider. That component was well built — RTL-aware clip
   maths, pointer capture, full keyboard support, ~170 lines — but none of it
   mattered because the interaction was never discovered. */
export function TryOnRevealFigure({
  caption,
  alt,
  productSrc,
  resultSrc,
}: {
  caption: string;
  alt: string;
  productSrc: string;
  resultSrc: string;
}) {
  return (
    <figure
      aria-label={alt}
      className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-muted"
    >
      <Image
        src={productSrc}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 384px"
        className="gc-tryon-garment object-cover"
      />
      <Image
        src={resultSrc}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 384px"
        className="gc-tryon-reveal object-cover"
      />
      <figcaption className="gc-tryon-caption absolute inset-x-4 bottom-4 rounded-full bg-foreground/85 px-3 py-2 text-center text-xs font-semibold text-background">
        {caption}
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run components/landing/try-on-reveal-figure.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 6: Commit**

```bash
git add components/landing/try-on-reveal-figure.tsx components/landing/try-on-reveal-figure.test.tsx app/globals.css
git commit -m "feat: the try-on reveal plays itself"
```

---

### Task 7: Delete `BeforeAfterSlider`, mount the figure

**Files:**
- Modify: `components/landing/site-landing.tsx` — delete `function BeforeAfterSlider` (starts at line 140, roughly 170 lines through the `role="slider"` block ending near line 315) and replace its usage at line 387

- [ ] **Step 1: Delete the component**

Remove the entire `BeforeAfterSlider` function — every helper it owns goes with it: `clamp`, `updateFromClientX`, `handlePointerDown`, `handlePointerMove`, `finishPointer`, `cancelPointer`, `handleKeyDown`, and the `reveal` / `activePointerRef` / `handleRef` state.

Then remove now-unused imports from line 3: `useRef` and `useState` if nothing else in the file uses them. Check first:

```bash
npx --no-install rg -n "useState|useRef" components/landing/site-landing.tsx
```

`TestimonialAvatar` at line 52 uses `useState`, so keep that one and drop only `useRef` if it has no other caller.

- [ ] **Step 2: Replace the usage**

At line 387, replace:

```tsx
<BeforeAfterSlider locale={locale} t={t} />
```

with:

```tsx
<TryOnRevealFigure
  caption={t.heroRevealCaption}
  alt={t.heroRevealAlt}
  productSrc="/try-on/mock-product.png"
  resultSrc="/try-on/mock-result.png"
/>
```

Add the import:

```tsx
import { TryOnRevealFigure } from '@/components/landing/try-on-reveal-figure';
```

- [ ] **Step 3: Confirm the product image exists**

```bash
ls public/try-on/
```

Expected: `mock-result.png` is known to exist. If `mock-product.png` does not, use the same file for both `productSrc` and `resultSrc` for now and note it — the animation still demonstrates the motion, and swapping in real photography is a content change, not a code change.

- [ ] **Step 4: Typecheck and run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors (the Task 5 errors are now resolved), 261 tests passing.

- [ ] **Step 5: Commit**

```bash
git add components/landing/site-landing.tsx
git commit -m "refactor: drop the drag slider nobody dragged"
```

---

### Task 8: Extract `SiteHeader` with a working mobile menu

`SheetContent`'s `side` prop is **physical** — it applies `right-0` or `left-0`. Passing a fixed `"right"` puts the panel on the physical right in Arabic, which is the start edge, so it must be derived from locale.

**Files:**
- Create: `components/landing/site-header.tsx`
- Test: `components/landing/site-header.test.tsx`
- Modify: `components/landing/site-landing.tsx:324-357` (remove the inline `<header>`, render `<SiteHeader />`)

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from '@/components/landing/site-header';
import { enLandingCopy } from '@/lib/landing/landing-i18n';

function renderHeader(locale: 'en' | 'ar' = 'en') {
  return render(<SiteHeader locale={locale} t={enLandingCopy} />);
}

describe('SiteHeader', () => {
  /* The defect: below 640px the wordmark, sign-in and book-a-call were each
     hidden behind a breakpoint and no menu button existed at any width, so a
     phone visitor had no route off the page at all. */
  it('exposes a menu button', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('keeps the primary call to action reachable without opening the menu', () => {
    renderHeader();
    const cta = screen.getByRole('link', { name: /book a call/i });
    expect(cta.className).not.toContain('hidden');
  });

  it('reveals navigation, sign-in, language and theme once opened', async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: /menu/i }));

    expect(await screen.findByRole('link', { name: /pricing/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/landing/site-header.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/landing/site-header"`

If `enLandingCopy` is not an existing export, check the real export name first and use it:

```bash
npx --no-install rg -n "^export (const|function)" lib/landing/landing-i18n.ts
```

- [ ] **Step 3: Write the component**

```tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { LandingLocaleToggle } from '@/components/landing/landing-locale';
import { BOOKING_URL } from '@/lib/booking';
import type { LandingTranslator, SiteLocale } from '@/lib/landing/landing-i18n';

export function SiteHeader({ locale, t }: { locale: SiteLocale; t: LandingTranslator }) {
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: '#how', label: t.navHow },
    { href: '#demo', label: t.navDemo },
    { href: '#benefits', label: t.navBenefits },
    { href: '#pricing', label: t.navPricing },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" aria-label={t.brandHome} className="min-w-0 rounded-lg">
          <BrandLogo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/* A bare hamburger would hide the conversion path behind a tap. The
              one action that earns money stays on screen at every width. */}
          <Button asChild size="sm" className="rounded-full px-4 font-semibold">
            <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">{t.bookCall}</a>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t.menu}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>

            {/* `side` is physical, not logical — a fixed "right" lands on the
                start edge in Arabic. Derive it so the panel opens from the end
                edge in both directions. */}
            <SheetContent side={locale === 'ar' ? 'left' : 'right'} className="w-80 max-w-[85vw]">
              <SheetTitle className="px-4 pt-4">{t.menu}</SheetTitle>

              <nav className="flex flex-col px-4 pt-2">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center border-b border-border text-sm font-medium"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center text-sm font-medium"
                >
                  {t.signIn}
                </Link>
              </nav>

              <Separator className="my-2" />

              {/* Out of the bar, but still reachable from every screen. */}
              <div className="flex items-center gap-2 px-4 pb-4">
                <LandingLocaleToggle />
                <ThemeToggle />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Add the `menu` string to both dictionaries**

In `lib/landing/landing-i18n.ts`, add `menu: string;` to the interface, then:

```ts
  menu: 'Menu',
```

```ts
  menu: 'القائمة',
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run components/landing/site-header.test.tsx`
Expected: PASS, 3 tests

If `userEvent` is not already a dependency, check before assuming:

```bash
npx --no-install rg -n "user-event" package.json
```

If absent, drive the trigger with `fireEvent.click` from `@testing-library/react` instead of adding a dependency for one test.

- [ ] **Step 6: Replace the inline header**

In `site-landing.tsx`, delete lines 324–357 (the entire `<header>` element) and render in its place:

```tsx
<SiteHeader locale={locale} t={t} />
```

Add the import, and remove any imports the file no longer uses — likely `ThemeToggle` and `LandingLocaleToggle`, which now live in the header. Verify before deleting:

```bash
npx --no-install rg -n "ThemeToggle|LandingLocaleToggle|BOOKING_URL" components/landing/site-landing.tsx
```

- [ ] **Step 7: Make sure the footer still offers language and theme**

Moving these out of the top bar must not leave the page with only one route to
them. The footer is where people instinctively look.

```bash
npx --no-install rg -n "LandingLocaleToggle|ThemeToggle" components/landing/site-landing.tsx components/landing/landing-after-playground-sections.tsx
```

If neither appears in the footer block, add them there:

```tsx
<div className="flex items-center gap-2">
  <LandingLocaleToggle />
  <ThemeToggle />
</div>
```

If the footer already has them, change nothing — this step is a check, not an
edit.

- [ ] **Step 8: Run the suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, 261+ tests passing.

- [ ] **Step 9: Commit**

```bash
git add components/landing/site-header.tsx components/landing/site-header.test.tsx components/landing/site-landing.tsx lib/landing/landing-i18n.ts
git commit -m "feat: a mobile header with somewhere to go"
```

---

### Task 9: Container queries for the pinned preview

Root cause: a sticky element with unbounded height in the same scroll column as the controls. Viewport breakpoints are the wrong tool because `admin-settings.tsx` mounts this inside a Shopify iframe, where `lg:` measures the iframe and `vh` measures a box that may not scroll at all.

**Files:**
- Modify: `components/try-on/settings-controls.tsx:131-136`
- Test: `components/try-on/settings-controls.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/* Regression guard for the reported defect: the five-tab preview grew tall
   enough that controls scrolled underneath it and stayed hidden. Sticky must
   be conditional on container width, never unconditional. */
describe('TryOnSettingsControls preview pinning', () => {
  it('never pins the preview unconditionally', async () => {
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile('components/try-on/settings-controls.tsx', 'utf8'),
    );

    expect(source).not.toContain('sticky top-0 z-10');
    expect(source).toContain('@container');
    expect(source).toContain('@3xl:sticky');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/try-on/settings-controls.test.tsx`
Expected: FAIL — the source still contains `sticky top-0 z-10`

- [ ] **Step 3: Rewrite the layout**

Replace lines 131–136:

```tsx
  return (
    <div className="grid gap-6">
      {/* Sticky so the preview stays in view while controls are tuned */}
      <div className="sticky top-0 z-10 -mx-6 border-b bg-background px-6 pb-4 pt-1">
        <WidgetPreview s={s} copy={c} />
      </div>
```

with:

```tsx
  return (
    /* Container, not viewport: one of the two mounts is a Shopify iframe where
       `lg:` measures the iframe and `vh` measures a box that may not scroll.
       48rem is where a label and its input still sit side by side — confirm it
       against the real panel and adjust if it feels tight. */
    <div className="@container grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @3xl:items-start">
      {/* Below 48rem this is ordinary content and scrolls away. At or above it,
          the preview has its own column and cannot cover controls that are no
          longer beneath it. */}
      <div className="order-first -mx-6 border-b bg-background px-6 pb-4 pt-1 @3xl:order-last @3xl:mx-0 @3xl:self-start @3xl:sticky @3xl:top-4 @3xl:border-b-0 @3xl:px-0">
        <WidgetPreview s={s} copy={c} />
      </div>

      <div className="grid gap-6">
```

Close the new controls wrapper `</div>` immediately before the component's existing closing `</div>`.

Tailwind's `@3xl` container breakpoint is 48rem, matching the spec.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/try-on/settings-controls.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify both mounts still render**

Run: `npx vitest run components/dashboard components/shopify`
Expected: all passing. These cover `tryon-settings-panel.tsx` and `admin-settings.tsx`, the two callers.

- [ ] **Step 6: Commit**

```bash
git add components/try-on/settings-controls.tsx components/try-on/settings-controls.test.tsx
git commit -m "fix: preview gets its own column instead of covering the controls"
```

---

### Task 10: Prove the overflow is actually gone

A green unit suite is not evidence for a layout defect. This is the proof.

**Files:**
- Create: `e2e/mobile-overflow.spec.ts`

- [ ] **Step 1: Check how Playwright is invoked in this repo**

```bash
npx --no-install rg -n "playwright" package.json
ls e2e playwright.config.* 2>/dev/null
```

If no Playwright config exists, create the spec anyway and run it with `npx playwright test e2e/mobile-overflow.spec.ts` — it will scaffold on first run and prompt for browser install.

- [ ] **Step 2: Write the sweep**

```ts
import { test, expect } from '@playwright/test';

const WIDTHS = [320, 360, 390, 430];
const LOCALES = ['en', 'ar'] as const;

for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    test(`landing has no horizontal overflow at ${width}px in ${locale}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${locale}`);
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
      });

      /* One pixel of slack absorbs sub-pixel rounding; anything beyond that is
         a real element pushing the page wide. */
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
}
```

- [ ] **Step 3: Start the dev server and run it**

Use the preview tooling to start the dev server rather than a bare shell command, then:

```bash
npx playwright test e2e/mobile-overflow.spec.ts
```

Expected: 8 passing (4 widths × 2 locales).

- [ ] **Step 4: Fix whatever it catches**

If a width fails, find the offending element before changing anything:

```ts
const wide = await page.evaluate(() =>
  Array.from(document.querySelectorAll('*'))
    .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
    .slice(0, 10)
    .map((el) => el.tagName + '.' + (el.className || '').toString().slice(0, 80)),
);
console.log(wide);
```

Fix the specific element. The eyebrow pattern was the cause visible statically; this step exists precisely because it may not have been the only one.

- [ ] **Step 5: Commit**

```bash
git add e2e/mobile-overflow.spec.ts
git commit -m "test: assert no horizontal overflow across phone widths in both languages"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: at least 261 tests passing, plus the new ones. Zero failures.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: clean. Unused imports from the deletions in Tasks 4, 7 and 8 are the likely offenders.

- [ ] **Step 3: Confirm the slider is genuinely gone**

```bash
npx --no-install rg -n "BeforeAfterSlider|heroSlider" .
```

Expected: no matches anywhere, including the i18n file.

- [ ] **Step 4: Visual check at 360px in both languages**

Load the landing page in the preview browser at 360px wide, in English and Arabic. Confirm by eye: the menu button opens the sheet from the correct edge in each language, the step markers read as single marks, and the try-on figure animates and settles.

- [ ] **Step 5: Commit anything outstanding**

```bash
git status
```

Expected: clean tree. The auth redirect fix from before this branch is still uncommitted and deliberately untouched — leave it, or commit it separately, but do not fold it into this work.

---

## Notes carried from the spec

Two things are known unknowns, to be resolved by inspection during the build rather than guessed at:

- Whether the Shopify iframe is fixed-height or auto-resized by App Bridge. This decides whether the sticky path in Task 9 is reachable in that mount at all. If the iframe auto-sizes, sticky is inert there and the preview simply scrolls — the safe outcome, and no further work.
- Whether any overflow source exists beyond the eyebrow pattern. Task 10 Step 4 settles it.

One deliberate simplification: `TryOnRevealFigure` uses the same wipe direction in both languages. If the reveal reads backwards in Arabic during Task 11 Step 4, add a `dir`-scoped variant of `gc-tryon-reveal` that clips from the opposite edge — roughly four lines of CSS, not a redesign.
