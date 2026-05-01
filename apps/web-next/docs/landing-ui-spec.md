# Landing UI System Spec

Scope: `apps/web-next` landing page only. Use existing shadcn/ui, Radix, Tailwind 4, and small composition components. Do not create low-level primitives.

## Foundations

### Containers

| Surface | Class target | Exact rule |
|---|---|---|
| Normal section inner | `mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8` | Max 1200px, 16px mobile padding, 24px tablet, 32px desktop |
| Hero inner | `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8` | Max 1280px only for hero/large preview |
| Section shell | `border-b border-white/10` | Use `border-border` only where shadcn card contrast is better |
| Section padding | `py-14 lg:py-24` | 56px mobile, 96px desktop default |
| Large feature padding | `py-16 lg:py-28` | 64px mobile, 112px desktop max |
| Dense section padding | `py-12 lg:py-20` | 48px mobile, 80px desktop |

### Background

Base theme stays dark through `ThemeProvider` default. Landing sections should read near-black with white text and low-opacity blue/purple AI glow.

Allowed background layers:

- Base: `bg-background`, `bg-muted/10`, `bg-card/60`, `bg-white/[0.03]`.
- Borders: `border-white/10`, hover to `border-white/20`.
- Hero grid: subtle 1px grid at 48px cells, opacity below 8%.
- Hero glow: radial blue/purple only, opacity 5% to 14%, blur 64px to 120px.
- No stock images, video backgrounds, rainbow gradients, or large decorative blobs.

### Typography

| Element | Mobile | Tablet | Desktop | Notes |
|---|---:|---:|---:|---|
| Hero badge | `text-[11px] leading-3` | same | same | `font-semibold uppercase tracking-[0.2em]` |
| Hero h1 | `text-[44px] leading-[1.05]` | `sm:text-[56px] sm:leading-[1.02]` | `lg:text-[72px] lg:leading-[1]` | Max line length near 11 words |
| Hero body | `text-base leading-[1.65]` | `sm:text-lg` | same | `text-muted-foreground`, max width 640px |
| Section eyebrow | `text-[11px]` | same | same | `font-semibold uppercase tracking-[0.22em] text-muted-foreground` |
| Section h2 | `text-[30px] leading-[1.1]` | `sm:text-4xl` | `lg:text-[44px] lg:leading-[1.05]` | No viewport-scaled font |
| Body | `text-base leading-[1.65]` | `sm:text-lg` optional | same | Use 16px default, 18px for intro only |
| Card title | `text-[15px]` | `sm:text-base` | up to `text-lg` | Keep compact inside panels |
| Card body | `text-[13px] leading-[1.55]` | `text-sm` | same | Avoid paragraph walls |

Letter spacing must not be negative. Use tighter line-height only for true hero/section headings.

## Components

### Buttons

Use `Button` from `@/components/ui/button`.

| Button | Class target | Exact rule |
|---|---|---|
| Hero primary | `h-12 rounded-xl px-5 text-sm font-semibold lg:px-6` | 48px desktop, 44px mobile acceptable through `h-11` in dense stacks |
| Primary | `h-11 rounded-xl px-4 text-sm font-semibold` | Use `size="lg"` plus class overrides |
| Secondary/outline | `h-11 rounded-xl border-white/10 bg-white/[0.03] px-4 hover:bg-white/[0.06]` | Same height as primary |
| Tiny action | `h-9 rounded-lg px-3 text-xs font-medium` | For chips/locked actions |
| Icon gap | `gap-2` | Icon size 16px |

Hero CTA may use a subtle shadow/glow: `shadow-[0_0_32px_rgba(99,102,241,0.18)]`. Do not apply heavy glow to all buttons.

### Cards

Use `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`.

| Card | Class target | Exact rule |
|---|---|---|
| Landing card | `rounded-2xl border-white/10 bg-card/60` | Padding 20px mobile, 24px desktop via content classes |
| Glass card | `rounded-2xl border-white/10 bg-white/[0.03] backdrop-blur` | Use sparingly |
| Feature card | `min-h-40 rounded-2xl` | Icon box 40px mobile, 44px desktop |
| Playground card | `rounded-3xl border-white/10 bg-card/70` | Padding 16px mobile, 24px desktop |
| Result tile | `rounded-xl border-white/10 bg-white/[0.03] p-4` | Stable height where possible |

Hover may use `transition duration-200 hover:-translate-y-0.5 hover:border-white/20`; disable movement under `prefers-reduced-motion`.

### Inputs

Use existing shadcn `Input`. Current repo has no `Textarea`; use styled `textarea` inside composition until added through shadcn.

| Input | Class target | Exact rule |
|---|---|---|
| Textarea | `min-h-32 rounded-xl border border-white/10 bg-background/70 p-3 text-sm leading-[1.55]` | Focus `focus-visible:ring-2 focus-visible:ring-primary/40` |
| File area | `min-h-24 rounded-xl border border-dashed border-white/15 p-4` | Label 13px, helper 12px |
| Inline text input | `h-11 rounded-xl border-white/10 bg-background/70` | Preserve shadcn focus |

### Tabs / Mode Selector

Use `Tabs`, `TabsList`, `TabsTrigger` from `@/components/ui/tabs` when state shape fits. Otherwise use `Button` composition with same sizing.

Mode selector target:

- Height: 44px.
- Radius: `rounded-xl`.
- Icon: 16px.
- Text: 13px semibold.
- Active: `bg-primary text-primary-foreground`.
- Inactive: `border border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground`.
- Gap: 8px.

Only 3 modes are interactive in this phase:

- Workflow Planner.
- Voice Lead Capture.
- File/Image Intake.

Other multimodal capabilities may appear visually as locked/preview cards, but should not imply active execution.

### Badges

Use `Badge` from `@/components/ui/badge`.

| Badge | Class target | Exact rule |
|---|---|---|
| Eyebrow | `h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.18em]` | For hero/section labels |
| Status | `h-6 rounded-full px-2.5 text-[11px]` | For result/status labels |
| Outline chip | `rounded-full border-white/10 bg-white/[0.03]` | Avoid loud colors |

## Section Patterns

### Hero

- Layout: two columns at `lg`, single column below.
- Grid: `lg:grid-cols-[1fr_0.92fr]`, gap 40px mobile, 64px desktop.
- Copy stack: `space-y-6`.
- CTA group: `flex flex-col gap-3 sm:flex-row`.
- Proof chips: `flex flex-wrap gap-x-6 gap-y-2`.
- Right preview: mini animated workflow only, not full playground.
- H1 must name business outcome, not “demo”.

### Playground

- Section directly below hero.
- Shell: `rounded-3xl` cards, two columns at `lg:grid-cols-[1.02fr_0.98fr]`.
- Panel gap: 16px mobile, 24px desktop.
- Input/result panels must have stable dimensions to avoid layout jump.
- Avoid public words: “anonymous”, “limited”, “fake”, “demo only”.
- Use approved wording:
  - “Try a guided preview”
  - “Preview your AI workflow”
  - “Unlock save, deploy, sync, and export”
  - “Start your 14-day trial”

### Trial Path

Show path in 3 cards:

1. Free guided preview.
2. Start 14-day trial.
3. Custom implementation.

Use pricing-card rhythm from Shadboard, but no billing toggle unless actual pricing appears.

### Product Power / Proof

Use Shadboard dashboard/card density:

- 3 to 4 compact metric/proof cards.
- One larger operations panel.
- Optional Recharts only if existing chart component/data stays static and lightweight.
- No new table dependency.

### Workflow Pipeline

Use Kanban visual reference only:

- Static columns/cards.
- No drag/drop dependency.
- Columns: Capture, Understand, Route, Act, Observe.
- Mobile: horizontal scroll or stacked cards with no overflow.

## Spacing

| Relationship | Rule |
|---|---|
| Hero copy items | 24px |
| Hero CTA group | 12px |
| Hero proof chips | 12px row, 24px column |
| Section heading to content | 28px mobile, 40px desktop |
| Card grid | 16px mobile, 20px tablet, 24px desktop |
| Playground panels | 16px mobile, 24px desktop |
| Card internal stack | 16px default |
| Dense result tile stack | 12px |

## Animation

- Hover transitions: 180ms to 320ms.
- Hero trail loops: 6s to 14s.
- Processing steps: 500ms to 900ms.
- Avoid fast flashing and opacity pulses below 1s.
- Avoid infinite heavy transforms across large card grids.
- Existing `prefers-reduced-motion` block must cover new landing classes.

## Responsive / RTL / A11y

- No hardcoded widths except max-width containers and fixed icon/button sizes.
- Use `minmax(0, 1fr)` behavior through Tailwind grids; prevent horizontal overflow.
- Mobile breakpoint risk checks: 390px, 480px, 640px, 768px, 1024px.
- Prefer logical class thinking; avoid left/right-specific CSS in custom rules.
- Icons that imply direction should use start/end spacing (`ms-*`, `me-*`) where practical or be reviewed for RTL.
- Text must wrap inside buttons/cards; no clipped long labels.
- Focus states must remain visible on buttons, tabs, inputs, and gated actions.
- Animated content must not be essential for comprehension.

## Dependencies

No new dependency required for the landing phase.

Avoid:

- `@hello-pangea/dnd` for pipeline; use static Kanban-style composition.
- `@fullcalendar/*` for schedule previews; use static cards.
- `@tanstack/react-table` for proof; use simple shadcn table/cards if needed.
- `framer-motion` unless CSS animation proves insufficient.
- `embla-carousel-react` unless a carousel becomes required.

## Forbidden Areas

Do not touch:

- Supabase schema, migrations, RLS, storage, or keys.
- Clerk auth config or middleware.
- Dashboard routes/features.
- n8n workflows/contracts.
- Widget runtime.
- Root Vite app.
- GitHub Actions/deploy automation.
