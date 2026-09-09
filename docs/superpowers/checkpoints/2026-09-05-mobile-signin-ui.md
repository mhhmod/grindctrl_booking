# Local event: mobile sign-in discoverability and brand overlap

Date: 2026-09-05, Africa/Cairo.
Scope: landing-header bug fix, not an authentication redesign or a production release.
User request: make the ambiguous sign-in icon clear and easy to use, and leave a local record for future sessions.
Base repository checkpoint: `main`, `92f4d0f`; unrelated working-tree changes preserved.

## Root cause and fix

The narrow header attempted to fit the full brand, an icon-only sign-in, booking and menu into one row. The brand link could shrink while its inline-flex logo retained intrinsic width. At the user's approximately 343px viewport, the sign-in icon visually collided with the wordmark and its purpose was unclear.

Changed only the landing header and its tests:

- `apps/web-next/components/landing/site-header.tsx`: below 640px, brand/menu occupy row one and visibly labelled Sign in/Book a call occupy row two. Controls have a minimum 44px target; shared logo assets and authentication behaviour are unchanged. At 640px and above the header uses one row; desktop navigation remains at its existing breakpoint.
- `apps/web-next/components/landing/site-header.test.tsx`: added localized visible sign-in and booking checks, destination assertions and menu sign-in dismissal coverage alongside existing menu/locale/focus tests.
- `AGENTS.md`: regression guard points future sessions to this record.

The change deliberately spends a second header row on narrow screens to preserve the full brand and readable actions in both languages. Do not compress it back into an ambiguous icon without a verified alternative.

## Verification record

- Focused header Vitest: 7/7 passed.
- Broader landing/auth regression suite: 11 files, 56 tests passed, no warnings.
- `npm run typecheck`: passed.
- Scoped ESLint and `git diff --check`: passed (Git may report existing CRLF normalization notices).
- `npm run build` from `apps/web-next`: passed, exit 0, including type validation and 66 generated static pages. Next's build skips lint by configuration; the separately run scoped lint is the lint evidence. Existing multiple-lockfile/workspace-root warning remains.
- Real headed Chrome, local Next page: tested widths 320, 343, 375, 390, 640, 768, 1024 and 1440 in English/LTR and Arabic/RTL, light and dark. Measured visible header controls for pairwise overlap, document overflow and sign-in height. See final verification status below.
- Opened the menu, changed language/theme using real controls, closed with Escape and observed focus return to the localized menu trigger after the exit animation.
- Booking destination remains the existing calendar URL; no booking was submitted.

Broader test command, from `apps/web-next`:

```powershell
npm test -- components/landing lib/landing components/dashboard/theme-toggle.test.tsx app/sign-in app/sign-up lib/auth/redirect.test.ts --maxWorkers=1
```

Browser artifacts are local under `output/playwright/`, named `signin-header-{en|ar}-{width}-{light|dark}.png`; menu capture: `signin-menu-ar-343-light.png`. These are real local screenshots, not production captures. The red Next development-issue badge is a development overlay associated with the local Clerk configuration, not a new header control.

## Local preview and authentication limitations

Use the same origin in the Next CLI hostname and browser:

```powershell
npm run dev -- --hostname localhost --port 3100
```

Open `http://localhost:3100`. Starting with `--hostname 127.0.0.1` caused Next's URL normalization and Clerk's same-page rewrite to disagree, producing a self-proxy loop and `ECONNRESET`. Restarting this task's server with `localhost` resolved the page HTTP500 without source, configuration or auth changes. Installed-runtime source and a small origin-comparison reproduction confirmed that mechanism.

The existing production Clerk configuration rejects localhost with an origin/domain error. Header rendering and local navigation can be checked, but a successful live login cannot be certified here. Do not bypass authentication or change production keys to make a screenshot pass. Use authorized development-instance configuration or an approved deployed domain for end-to-end login verification. Existing unit tests mock Clerk and therefore establish only shell/redirect behaviour.

## Future regression checklist

1. Inspect the existing header, BrandLogo, Button, Sheet and translations before editing; avoid globally changing BrandLogo for a local layout issue.
2. Check 320/343/375/390 and intermediate/desktop widths, both languages and themes. Confirm actual text is visible, targets are distinct and no page overflow appears.
3. Verify brand, sign-in, booking and menu by keyboard. Verify Escape/close returns focus after the sheet animation; test the language switch while the sheet is open.
4. Follow Sign in to the existing route. Separately verify loaded Clerk UI and completed login in an authorized environment; do not conflate navigation with authentication.
5. Run the focused and broader tests, typecheck and scoped lint. Preserve unrelated work and do not run a production build against the same `.next` output while a dev server is using it.
6. Capture local visual evidence and state exactly what remains unverified before deployment.

## Separate issue observed, not fixed in this change

At narrow width, a click on the Arabic footer language toggle was intercepted by the floating “Open assistant” launcher. The header-menu language toggle worked. Treat footer/widget collision as a separate responsive follow-up; this header fix is not proof the whole landing page has no UI defects.

Read-only follow-up at `https://grindctrl.cloud/sign-in`: the real Clerk form loaded with email, GitHub and Google choices, with no console errors/warnings during that observation. No credentials were entered, OAuth selected or login submitted. At 343px the floating support launcher visually covered part of Continue, and a horizontal scrollbar was visible. Capture: `output/playwright/signin-route-production-343.png`. These are unresolved production sign-in-page responsive issues, not part of the landing-header change; investigate actual overflow bounds and assistant placement before claiming complete sign-in UX readiness.

Measured live: document client width 328px, scroll width 335px; the auth main was 328px but its implicit grid column expanded to 335.333px, with both sections following that width. Clerk root/cardBox/card measured 303.333px. The local `auth-shell.tsx` uses an implicit single mobile grid track; inspect an explicit `minmax(0, 1fr)` track and `min-w-0` containment before considering any global overflow suppression. The shared assistant visibility helper currently explicitly allows auth routes (`lib/assistant/launcher-visibility.ts`), and `components/assistant/launcher.tsx` places its overlay at the viewport bottom/end. Any auth-route exclusion must update that deliberate policy and its tests. These are source-grounded follow-up candidates, not implemented fixes.

## Final verification status

All 32 viewport/language/theme combinations passed measured header-overlap and document-overflow checks; Sign in was 44px tall throughout. Representative mobile English/Arabic light/dark and desktop screenshots were visually inspected. Clicking the English header Sign in reached `/sign-in` and its Welcome back shell (HTTP200); the actual Clerk form/login remained blocked by the known local production-key origin restriction. No complete login was attempted or claimed.

Production build completed successfully after stopping this task's local dev server. No deployment performed. Header fix is locally verified; the additional live auth-page overflow/launcher issues above and completed-login verification remain open.
