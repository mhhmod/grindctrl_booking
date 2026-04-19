# AGENTS.md — GRINDCTRL Booking / Widget Site

## What this repo is

Static HTML/CSS/JS site — **no build step, no package.json, no npm**. Deployed to GitHub Pages on push to `main` via `.github/workflows/static.yml`.

The site serves as both a marketing landing page and host for several embedded product modules.

## Architecture at a glance

| File | Role |
|------|------|
| `index.html` | Landing page (Tailwind CDN + custom CSS) |
| `tokens.css` | Shared design tokens (spacing, radius, colors, shadows, motion) |
| `base.css` | Resets, font loading, fluid typography, animation primitives |
| `layout.css` | Shell, container, grid, drawer, page transitions, reveal |
| `components.css` | Reusable UI: badges, buttons, cards, inputs, chips, nav, CTAs |
| `chat-widget.css` / `.js` | Trial playground chat assistant (own `--gc-*` token scope) |
| `blueprint-studio.css` / `.js` | AI Blueprint Studio tool |
| `voice-to-value.css` / `.js` | Exception Desk triage workspace |
| `grindctrl-support.js` | Production embeddable widget (Shadow DOM, CDN-distributed) |
| `widget-admin.html` | Admin dashboard (standalone page) |
| `i18n.js` | EN/AR i18n dictionary + runtime swap |
| `supabase/*.sql` | Manual delta migrations (applied via Supabase MCP, not CLI) |

## CSS load order

`tokens.css` → `base.css` → `layout.css` → `components.css` → module CSS → inline `<style>` overrides.

The foundation layer defines shared tokens and patterns. Module CSS (`chat-widget.css`, `blueprint-studio.css`, `voice-to-value.css`) can override tokens in their own scope. The inline `<style>` in `index.html` contains page-specific overrides — keep it minimal.

## Two Supabase projects in play

- **Trial playground**: `qldgpkqpyfpqfdchozsp.supabase.co` — used by `chat-widget.js`
- **Production widget**: `egvdxshlbcqndrcnzcdn.supabase.co` — used by `grindctrl-support.js`

Do not mix up the anon keys or project refs. Check the `CONFIG` block at the top of each JS file.

## External services

- **n8n**: AI routing webhooks at `n8n.srv1141109.hstgr.cloud`. Webhook contracts are documented in `widget-n8n-contracts.md`.
- **Groq**: LLM provider for Blueprint Studio. Prompt templates in `groq-prompts.md` and `groq-blueprint-prompts.md`.
- **Cloudflare Workers AI**: Image generation model `@cf/black-forest-labs/flux-1-schnell`.

## Frontend conventions

- **No build tooling** — Tailwind loads via CDN (`cdn.tailwindcss.com`). The CDN warning is intentionally suppressed in `index.html`.
- **Dark mode** via `.dark` class on `<html>`. Default is dark.
- **CSS custom properties** for theming: `--gc-*` prefix throughout. Use `tokens.css` tokens (e.g., `--gc-space-4`, `--gc-radius-lg`, `--gc-ink`, `--gc-surface-container`) instead of magic values.
- **Font loading**: Google Fonts with Bunny.net fallback (3 s timeout per CDN). Material Symbols loaded directly (Bunny.net does not mirror icon fonts).
- **i18n**: Add `data-i18n="key"` to elements; `data-i18n-placeholder="key"` for inputs; `data-i18n-html="key"` for innerHTML swaps. Dictionary lives in `i18n.js`.
- **RTL**: Arabic triggers `dir="rtl"` automatically. All CSS must handle RTL — check existing patterns before adding layout. Use logical properties (`inset-inline-start`, `padding-inline`, etc.).
- **Shadow DOM**: `grindctrl-support.js` renders inside Shadow DOM for style isolation. Do not assume global CSS reaches it.
- **Component classes**: Use `.gc-btn`, `.gc-card`, `.gc-input`, `.gc-chip`, etc. from `components.css`. Prefer these over raw Tailwind for UI elements that appear more than once.
- **Breakpoints**: 390px (small phone), 480px (phone), 540px (large phone), 640px (sm/tablet), 768px (md), 1024px (lg), 1280px (xl), 1536px (2xl).

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

Push to `main` → GitHub Pages deploys the entire repo root. No build step. Changes go live immediately after the workflow completes.

## Common mistakes to avoid

- Do not add `package.json` or install npm dependencies — this is a static site.
- Do not assume a single Supabase project — there are two with different anon keys.
- Do not apply Supabase migrations via CLI — use MCP or manual SQL execution.
- Do not break the Tailwind CDN warning suppression (must be before Tailwind script loads).
- Do not add global CSS that could leak into the Shadow DOM widget.
- Do not hardcode Arabic text directly in JS — use `i18n.js` keys and the `t()` helper.
