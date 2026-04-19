# GRINDCTRL Booking / Widget Site

Vite-built static site deployed to GitHub Pages. Source lives in `src/`, Vite builds to `dist/`.

## Development

```bash
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview production build locally
```

## Playwright Tests

### Running locally

```bash
npm run build                        # must build first (tests run against vite preview)
npm test                             # run all tests
npm run test:ui                      # open Playwright UI mode (interactive)
npm run test:update-snapshots        # regenerate screenshot baselines
```

### CI behavior

The GitHub Actions workflow (`.github/workflows/static.yml`) runs on every push to `main` and every PR targeting `main`:

1. **test** job — installs deps, builds, installs Chromium, runs `npx playwright test`
2. **deploy** job — only runs if `test` passes AND the push is on `main` (not a PR)

If tests fail, the `test` job uploads a `playwright-report` artifact (retained 7 days) and the `deploy` job is skipped entirely.

### Updating snapshots

If you intentionally change UI layout, colors, or typography:

1. Run `npm run test:update-snapshots` locally
2. Review the changed files in `e2e/__screenshots__/`
3. Commit the updated baselines
4. Push — CI will use the new baselines

### Required GitHub settings

- **Settings → Pages → Source**: "GitHub Actions"
- **Settings → Branches → Branch protection rules** (optional but recommended):
  - Enable "Require status checks to pass before merging"
  - Add the `test` job as a required check

## Architecture

| Path | Role |
|------|------|
| `src/index.html` | Landing page |
| `src/tokens.css` | Design tokens |
| `src/base.css` | Resets, typography |
| `src/layout.css` | Shell, container, grid |
| `src/components.css` | UI components, nav, Shoelace overrides |
| `src/overrides.css` | Page-level overrides |
| `src/scripts/` | ES modules (header, Shoelace registry) |
| `src/public/scripts/` | Classic scripts (i18n, widgets) |
| `e2e/` | Playwright test suite |
