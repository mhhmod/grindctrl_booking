# AGENTS.md — GRINDCTRL Booking / Widget Site

## What this repo is

Vite-built static site deployed to GitHub Pages. Source lives in `src/`, Vite builds to `dist/`. The GitHub Actions workflow (`.github/workflows/static.yml`) runs `npm run build` and deploys `dist/`.

```bash
npm run dev      # local dev server (Vite)
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

## Architecture at a glance

| Path | Role |
|------|------|
| `src/index.html` | Landing page (Tailwind CDN + custom CSS + Shoelace) |
| `src/tokens.css` | Shared design tokens (spacing, radius, colors, shadows, motion) |
| `src/base.css` | Resets, font loading, fluid typography, animation primitives |
| `src/layout.css` | Shell, container, grid, page transitions, reveal |
| `src/components.css` | Reusable UI: badges, buttons, cards, inputs, chips, nav, CTAs |
| `src/fonts.css` | Self-hosted @font-face declarations for Inter, Manrope, IBM Plex Sans Arabic, Material Symbols Outlined |
| `src/fonts/` | Woff2 font files (variable + static). Sourced from @fontsource packages + Google. |
| `src/chat-widget.css` | Trial playground chat assistant (own `--gc-*` token scope) |
| `src/blueprint-studio.css` | AI Blueprint Studio tool |
| `src/voice-to-value.css` | Exception Desk triage workspace |
| `src/scripts/web-awesome.js` | Shoelace component registry (ES module) |
| `src/scripts/site-header.js` | Header/nav drawer logic (ES module) |
| `src/scripts/i18n.js` | EN/AR i18n dictionary + runtime swap |
| `src/scripts/chat-widget.js` | Trial playground widget logic |
| `src/scripts/voice-to-value.js` | Exception Desk triage logic |
| `src/scripts/grindctrl-support.js` | Production embeddable widget (Shadow DOM) |
| `src/scripts/blueprint-studio.js` | Blueprint Studio logic |
| `src/shoelace/` | Shoelace assets (icons). Copied from `node_modules` at setup. |
| `src/public/` | Static files copied as-is to `dist/` (scripts, SVGs, shoelace assets) |
| `vite.config.js` | Vite config. Root is `src/`, output is `dist/`, base is `./`. |

## CSS load order

`fonts.css` → `tokens.css` → `base.css` → `layout.css` → `components.css` → module CSS → inline `<style>` overrides.

The foundation layer defines shared tokens and patterns. Module CSS (`chat-widget.css`, `blueprint-studio.css`, `voice-to-value.css`) can override tokens in their own scope. The inline `<style>` in `index.html` contains page-specific overrides — keep it minimal.

## JS architecture

Two kinds of scripts in `src/`:
- **ES modules** (`<script type="module">`): `web-awesome.js`, `site-header.js`. Vite bundles these.
- **Classic scripts** (`<script src="...">`): `i18n.js`, `chat-widget.js`, `voice-to-value.js`. These live in `src/public/scripts/` and are copied as-is to `dist/scripts/` — no bundling.

Do not convert classic scripts to modules without testing the global `window.*` variables they export.

## Shoelace (Web Awesome)

Components from `@shoelace-style/shoelace`. Import only what you need in `src/scripts/web-awesome.js`. Icon assets are in `src/shoelace/icons/` — synced from `node_modules` manually.

To add a new Shoelace component:
1. `import '@shoelace-style/shoelace/dist/components/<name>/<name>.js';` in `web-awesome.js`
2. Use `<wa-*>` tag in HTML
3. Style overrides go in `components.css` using `wa-*::part(*)` selectors

## Two Supabase projects in play

- **Trial playground**: `qldgpkqpyfpqfdchozsp.supabase.co` — used by `chat-widget.js`
- **Production widget**: `egvdxshlbcqndrcnzcdn.supabase.co` — used by `grindctrl-support.js`

Do not mix up the anon keys or project refs. Check the `CONFIG` block at the top of each JS file.

## External services

- **n8n**: AI routing webhooks at `n8n.srv1141109.hstgr.cloud`. Webhook contracts are documented in `widget-n8n-contracts.md`.
- **Groq**: LLM provider for Blueprint Studio. Prompt templates in `groq-prompts.md` and `groq-blueprint-prompts.md`.
- **Cloudflare Workers AI**: Image generation model `@cf/black-forest-labs/flux-1-schnell`.

## Frontend conventions

- **Vite builds the site** — Tailwind still loads via CDN (`cdn.tailwindcss.com`). The CDN warning is intentionally suppressed in `index.html`.
- **Dark mode** via `.dark` class on `<html>`. Default is dark.
- **CSS custom properties** for theming: `--gc-*` prefix throughout. Use `tokens.css` tokens (e.g., `--gc-space-4`, `--gc-radius-lg`, `--gc-ink`, `--gc-surface-container`) instead of magic values.
- **Font loading**: Google Fonts with Bunny.net fallback (3 s timeout per CDN). Material Symbols loaded directly (Bunny.net does not mirror icon fonts).
- **i18n**: Add `data-i18n="key"` to elements; `data-i18n-placeholder="key"` for inputs; `data-i18n-html="key"` for innerHTML swaps. Dictionary lives in `i18n.js`.
- **RTL**: Arabic triggers `dir="rtl"` automatically. All CSS must handle RTL — check existing patterns before adding layout. Use logical properties (`inset-inline-start`, `padding-inline`, etc.).
- **Shadow DOM**: `grindctrl-support.js` renders inside Shadow DOM for style isolation. Do not assume global CSS reaches it.
- **Component classes**: Use `.gc-btn`, `.gc-card`, `.gc-input`, `.gc-chip`, etc. from `components.css`. Prefer these over raw Tailwind for UI elements that appear more than once.
- **Shoelace overrides**: Use `wa-*::part(*)` selectors in `components.css`. Do not put Shoelace styles in the inline `<style>` block.
- **Breakpoints**: 390px (small phone), 480px (phone), 540px (large phone), 640px (sm/tablet), 768px (md), 1024px (lg), 1280px (xl), 1536px (2xl).

## Next app UI front line

`apps/web-next` is the Next.js application surface. For UI work there, shadcn/ui is the first-line component source and `components.json` is the source of truth for shadcn settings:

- Check `apps/web-next/components/ui` before building a primitive from scratch.
- If a primitive is missing, add it with the shadcn CLI/MCP into `apps/web-next`, then adapt it locally.
- Prefer composition of shadcn primitives for buttons, cards, dialogs, sheets, forms, tables, tabs, menus, sidebars, command palettes, empty states, skeletons, and dashboard controls.
- Keep generated/copied shadcn components editable in-repo. Do not treat shadcn as an opaque package API.
- Preserve the current `components.json` choices: RTL enabled, Hugeicons icon library, Tailwind CSS variables, and aliases under `@/components`, `@/components/ui`, `@/lib`, and `@/hooks`.
- Use Shadboard (`https://github.com/Qualiora/shadboard`) as the primary dashboard layout/reference app because it targets Next 15, React 19, Tailwind, Radix UI, i18n, auth, and shadcn-style dashboard patterns.
- Use Kiranism Next Shadcn Dashboard Starter (`https://github.com/Kiranism/next-shadcn-dashboard-starter`) selectively for admin patterns such as charts, tables, filters, forms, command-k, and feature-based dashboard structure. Account for its newer Next version before copying patterns.
- Use CreemBase / UI Pacekit (`https://github.com/pacekit/creembase`) as a SaaS/Supabase/product-flow reference, especially for auth, billing, onboarding, pricing, and app shell ideas.
- These reference repos are not package dependencies or MCP servers unless they expose a shadcn-compatible registry URL. Inspect and adapt patterns instead of copying whole files blindly.
- For every non-trivial UI change: audit existing layout/components first, implement with shadcn-first primitives, then verify responsive behavior and RTL/LTR assumptions.

## Limits and quotas (hardcoded in JS)

- Anonymous session: 3 turns. Daily anonymous: 5. Daily authenticated: 10.
- Audio: max 30 s, max 2 MB, specific MIME types only (see `CONFIG.AUDIO_TYPES` in chat-widget.js).
- Messages: max 500 chars.
- Image generation: max 2 per session.

## Supabase migrations

SQL files in `supabase/` are **manual delta migrations** applied via Supabase MCP, not the Supabase CLI. They use `IF NOT EXISTS` guards for idempotency. When adding new tables:

1. Wrap in `begin;` / `commit;`.
2. Use `create table if not exists` / `alter table ... add column if not exists`.
3. Add RLS policies with `if not exists` guards.
4. Include storage bucket setup if needed (see `trial_playground_schema.sql` for pattern).

## Deploy

Push to `main` → GitHub Actions runs `npm ci && npm run build` → deploys `dist/` to GitHub Pages. No manual deploy step.

## GitHub Pages settings

Go to **Settings → Pages** and verify:
- **Source**: "GitHub Actions" (not "Deploy from a branch")

## Common mistakes to avoid

- Do not run `npm run build` at the project root and expect the old static files to work — source is in `src/`.
- Do not assume a single Supabase project — there are two with different anon keys.
- Do not apply Supabase migrations via CLI — use MCP or manual SQL execution.
- Do not break the Tailwind CDN warning suppression (must be before Tailwind script loads).
- Do not add global CSS that could leak into the Shadow DOM widget.
- Do not hardcode Arabic text directly in JS — use `i18n.js` keys and the `t()` helper.
- Do not convert classic scripts (`<script src="...">`) to modules without testing `window.*` exports.
- Do not add Google Fonts, Bunny Fonts, or any external font CDN link — all fonts are self-hosted in `src/fonts/` with `@font-face` declarations in `src/fonts.css`.
- To update font files, copy from `node_modules/@fontsource-variable/` or `node_modules/@fontsource/` into `src/fonts/` and update `src/fonts.css` if needed.
- Do not convert classic scripts (`<script src="...">`) to modules without testing `window.*` exports.
- Shoelace icon assets in `src/shoelace/` are synced from `node_modules/@shoelace-style/shoelace/dist/assets`. Re-sync after upgrading the package.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-widget-setup-flow/plan.md`
<!-- SPECKIT END -->
