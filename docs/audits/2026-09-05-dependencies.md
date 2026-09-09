# Dependency security audit — 2026-09-05

Status: compatible security updates applied locally; post-update verification recorded below. This document does not certify the deployed application or promise that every dependency is vulnerability-free.

## Scope and method

- Audited `package.json` / `package-lock.json` at the repository root and in `apps/web-next` using `npm audit --json` against the official npm registry.
- Compared installed packages with lockfile versions, inspected dependency parents with `npm explain`, and checked official registry engines/peer dependencies for the application framework and provider SDKs.
- Read maintainer security advisories independently of npm's database. This matters because the npm Next.js findings did not include the two August critical advisories described by Next.js maintainers.
- Authorized change scope: compatible dependency fixes in those two package sets. No major framework migration, `npm audit fix --force`, TLS bypass, provider-account change, production exploit test or deployment.
- Local environment: Node `24.14.1`, npm `11.11.0`, Windows. `strict-ssl` remained `true`; registry remained `https://registry.npmjs.org/`.
- Install lifecycle scripts are disabled for this update. In particular, the root's existing postinstall replaces the vendored Shoelace asset directory; those unrelated assets must not change during a dependency audit.

## Baseline findings

These are npm's counts of affected package nodes, including parent packages with vulnerable dependencies. They are not counts of independently exploitable application bugs or unique advisories.

| Package set | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Root | 1 | 12 | 13 | 1 | 27 |
| `apps/web-next` | 2 | 14 | 3 | 4 | 23 |

### Priority findings and applicability

| Finding | Evidence and local applicability | Remediation |
| --- | --- | --- |
| Next.js maintenance release behind security patches | Both locked and installed version were `15.5.15`. Maintainers require at least `15.5.24` for the August release. The AVIF image optimization vulnerability concerns attacker-controlled image processing. The separate Windows RCE requires a Windows filesystem and combined Pages/App Router configuration; its presence in the advisory is not proof that this deployment meets those conditions. Earlier middleware, SSRF, cache and denial-of-service fixes are also missing from `15.5.15`. | Update within the existing `15.5` maintenance line to `15.5.25`. |
| Root Clerk browser SDK authorization predicate bypass | Root pins a direct `@clerk/clerk-js` dependency at `6.7.4`; the maintainer's fixed version is `6.7.5`. Combined authorization predicates are affected; this is not a session-token or login impersonation vulnerability. Web-next already has the patched `@clerk/nextjs@6.39.3` / `@clerk/shared@3.47.5` authorization fix. | Root Clerk JS `6.7.5`; refresh vulnerable cookie-helper dependencies separately. |
| Vite Windows development-server file access | Root uses `6.4.2`, which is within the maintainer's affected range. Web-next's Vitest tree uses Vite `7.3.2`. The Windows alternate-path issue is relevant when the development server is exposed and sensitive files exist in its allowed tree. Root Vite config has no `server.host` setting. | Root `6.4.3`, compatible patched Vite transitive version in web-next. |
| Vitest UI file read / execution | Web-next has `vitest@3.2.4`. The maintainer advisory describes Windows UI/browser mode or an exposed API server; ordinary `vitest run` is not evidence of that exposure. npm's current affected range is `<3.2.6`, stricter than the maintainer page's initial `3.2.5` fix. | Use `3.2.6` to satisfy the current npm range. |
| PostCSS source-map file disclosure | Direct web-next PostCSS and root's transitive PostCSS are `8.5.10`; Next also pins its own `8.4.31`. Processing untrusted CSS with source-map loading is the affected behavior; no production exploit was attempted. | Direct floor `8.5.23`; inspect the nested Next dependency separately rather than claiming that the direct update fixes every copy. |
| Transitive runtime and development tooling findings | Includes `ws`, `js-cookie`, `tar`, parsing/build packages and root Clerk wallet/mobile dependencies. Exposure depends on which package APIs the application or build actually executes. | Refresh supported versions under existing parent ranges; report anything requiring an incompatible parent/library migration. |

Primary sources:

- [Next.js August 2026 security release](https://nextjs.org/blog/august-2026-security-release)
- [Next.js AVIF image optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)
- [Clerk combined authorization predicate advisory](https://github.com/clerk/javascript/security/advisories/GHSA-w24r-5266-9c3c)
- [Vite Windows alternate-path advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)
- [Vitest UI file access advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp)
- [PostCSS source-map disclosure advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp)

### Complete baseline package inventory reported by npm audit

| Package set | Severity | Packages |
| --- | --- | --- |
| Root | Critical | `shell-quote` |
| Root | High | `@clerk/clerk-js`, `@clerk/shared`, `browserslist`, `image-size`, `js-cookie`, `metro`, `metro-config`, `metro-transform-worker`, `nanoid`, `postcss`, `vite`, `ws` |
| Root | Moderate | `@solana-mobile/mobile-wallet-adapter-protocol-web3js`, `@solana-mobile/wallet-adapter-mobile`, `@solana/wallet-adapter-base`, `@solana/wallet-adapter-react`, `@solana/wallet-standard`, `@solana/wallet-standard-wallet-adapter`, `@solana/wallet-standard-wallet-adapter-base`, `@solana/wallet-standard-wallet-adapter-react`, `@solana/web3.js`, `jayson`, `stream-json`, `uuid`, `viem` |
| Root | Low | `@babel/core` |
| Web-next | Critical | `tar`, `vitest` |
| Web-next | High | `@clerk/shared`, `brace-expansion`, `browserslist`, `fast-uri`, `hono`, `ip-address`, `js-cookie`, `js-yaml`, `nanoid`, `next`, `postcss`, `sharp`, `vite`, `ws` |
| Web-next | Moderate | `@hono/node-server`, `express-rate-limit`, `qs` |
| Web-next | Low | `@babel/core`, `body-parser`, `esbuild`, `postcss-selector-parser` |

## Framework/provider compatibility

Baseline lockfile and installed versions matched for every row below. The official npm registry returned HTTP 200 metadata for all queried versions. This verifies declared compatibility; integration tests are still needed after installation.

| Package | Baseline installed/locked | Compatibility check |
| --- | --- | --- |
| `next` | `15.5.15` | Proposed `15.5.25` accepts React/React DOM `^19.0.0`; local Node satisfies its engine. |
| `react`, `react-dom` | `19.2.5` each | Versions match. No direct React runtime advisory was reported by these scans. Next's bundled server components are handled through the Next patch. |
| `@clerk/nextjs` | `6.39.3` | Accepts Next `^15.2.3` and React/React DOM `~19.2.3`; existing versions and proposed Next patch satisfy them. |
| `@clerk/localizations` | `4.13.8` | Brings its own `@clerk/shared@4.25.8`; do not confuse it with the framework's `3.x` shared dependency. |
| `@clerk/themes` | `2.4.57` | Uses framework-compatible shared `3.x` dependency. |
| `@supabase/supabase-js` | `2.104.0` in both sets | Requires Node `>=20`; local Node satisfies it. Realtime's transitive `ws` still needs the audit fix. |
| `groq-sdk` | `1.5.0` | No engine/peer restrictions returned by this version's registry metadata and no audit finding on the SDK. This does not validate model availability, costs or account limits. |
| `@upstash/ratelimit` | `2.0.8` | Requires `@upstash/redis ^1.34.3`. |
| `@upstash/redis` | `1.38.2` | Satisfies the limiter's peer requirement; no direct audit finding. |
| `@sentry/nextjs` | `10.70.0` | Supports Next `^15.0.0-rc.0`, among other lines, and Node `>=18`; compatible with the proposed Next maintenance patch. |
| `eslint-config-next` | `16.0.8` | Existing major mismatch with Next `15.x` recorded. No downgrade/major migration included in this patch lane; current project's lint configuration already uses this package. |

Official metadata checks used version endpoints at `https://registry.npmjs.org/<package>/<version>` and `npm view <package>@<version> engines peerDependencies --json`. Next `15.5.25` supports optional Sharp `^0.34.3 || ^0.35.4`, permitting a supported Sharp security refresh without forcing an unsupported version. It still pins PostCSS `8.4.31` internally.

## Authorized direct version floors

| File | Package | Previous manifest floor | New manifest floor |
| --- | --- | --- | --- |
| Root `package.json` | `vite` | `^6.3.0` | `^6.4.3` |
| Root `package.json` | `@clerk/clerk-js` | `^6.7.4` | `^6.7.5` |
| Web-next `package.json` | `next` | `^15.4.9` | `^15.5.25` |
| Web-next `package.json` | `postcss` | `^8.5.6` | `^8.5.23` |
| Web-next `package.json` | `vitest` | `^3.2.4` | `^3.2.6` |

The lockfiles retain the reviewed direct versions exactly: root Clerk `6.7.5` / Vite `6.4.3`; web-next Next `15.5.25` / PostCSS `8.5.23` / Vitest `3.2.6`. Existing caret conventions remain in manifests. Reproducible verification/deployments should consume these lockfiles with `npm ci`, not regenerate arbitrary newer versions.

### Narrow dependency overrides

- Web-next: `next -> postcss: 8.5.23`. Next `15.5.25` still declares `8.4.31`; updating the direct PostCSS does not protect that nested copy. The approved scoped override replaces it without a Next 16 migration. `npm ls postcss --depth=1` exits zero and shows Next, Tailwind and other consumers using the single installed `8.5.23` copy. An initial `npm install`/`npm update next` preserved the stale nested node; explicitly reifying `next@15.5.25` removed it. CSS processing and the final Next build/browser remain compatibility gates for this deviation from Next's exact pin.
- Root: `@react-native/community-cli-plugin -> metro: 0.84.5, metro-config: 0.84.5`. Both satisfy that parent's original `^0.84.0` ranges. Its exact cyclic Metro subgraph initially remained at `0.84.3` after `npm update`; the scoped override moved the graph to `0.84.5`. The path was Clerk JS -> Solana wallet React/mobile adapter -> optional React Native storage / React Native `0.85.1` -> CLI plugin -> Metro -> `image-size@1.2.1`. The final lockfile contains Metro/config/transform-worker `0.84.5` and **no `image-size` package**. The maintainer explicitly replaced image-size to address its advisories. [Metro 0.84.5 release](https://github.com/react/metro/releases/tag/v0.84.5)

Other refreshed transitive packages stay within the dependency ranges of their current parents. Important results include Sharp `0.35.4` with libvips `8.18.6`, Hono `4.13.7`, Hono Node server `1.19.17`, tar `7.5.22`, js-cookie `3.0.7`, shell-quote `1.10.0`, supported `ws` `7.5.13`/`8.21.x` copies, and viem `2.56.3` removing its old exact `ws@8.18.3` path. No direct framework/provider major upgrade was made. Pre-existing `shadcn@4.4.0` brings CLI/MCP tooling dependencies even though it is listed in `dependencies`; an audit node in that tree is not proof of an exposed app HTTP handler. The pre-existing `eslint-config-next@16.0.8` major differs from the Next runtime and was not introduced or upgraded here.

## Command notes and other manifests

- Initial audit and registry requests were slow but eventually completed. No certificate error occurred; SSL verification was not changed.
- A PowerShell summary wrapper around `npm audit fix --dry-run --ignore-scripts --json` failed with `ConvertFrom-Json: Unexpected character encountered while parsing value: a.` npm emitted non-JSON text before the JSON summary. This was a reporting/parser error, not a failed vulnerability scan. Package files remained unchanged after that dry run.
- `apps/grindctrl-tryon/package.json` only declares a private package name, with no dependency set to audit there.
- `apps/clerk-mcp/package.json` declares a private local Node service (`node >=20`) and no package dependencies. It was inventoried only; no files were changed.

## Post-update verification

Final `npm audit --json` results after all mutations:

| Package set | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Root | 0 | 0 | 13 | 0 | 13 |
| `apps/web-next` | 0 | 0 | 0 | 0 | 0 |

Vite `7.3.6` widened its supported esbuild range to `^0.27.0 || ^0.28.0`, permitting the final `esbuild@0.28.2` refresh without an override. This removes the Windows esbuild development-server advisory. The counts describe the current npm advisory database and lockfiles, not absence of undiscovered vulnerabilities. [esbuild maintainer advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr)

### Residual root findings: two advisories, 13 package nodes

The remaining path is root Clerk JS -> Solana wallet packages -> `@solana/web3.js@1.98.4` -> `jayson@4.3.0` -> `stream-json@1.9.1` and `uuid@8.3.2`. `jayson@4.3.0` is still the latest official release and requires `stream-json ^1.9.1` / `uuid ^8.3.2`. npm proposes a **major Clerk downgrade to 5.114.1**, not a safe compatible fix; that was not applied. Overriding these libraries to incompatible majors or changing the auth/wallet stack needs a separate reviewed migration.

| Advisory | Exact remaining risk and reachability evidence | Decision |
| --- | --- | --- |
| `stream-json` path-filter quadratic processing, GHSA-528h-pc64-c93x | Untrusted deeply nested JSON passed through `pick`/`ignore`/`filter`/`replace` can block the event loop. The maintainer identifies `3.5.0` as fixed and explicitly excludes the `StreamValues` family. Installed Jayson `lib/utils.js:3-4,79-80` imports `StreamValues` and `Verifier`, not those path filters. The root app has no direct stream-json imports. This is evidence against an exploitable path through the inspected Jayson calls, not proof that arbitrary future consumers are safe. | Remains in npm audit because vulnerable code is installed. Do not force a 1.x -> 3.x API change. [Maintainer advisory](https://github.com/uhop/stream-json/security/advisories/GHSA-528h-pc64-c93x) |
| `uuid` supplied-buffer bounds handling, GHSA-w5hq-g745-h8pq | Affects `v3`/`v5`/`v6` when callers supply a buffer/offset; fixed versions start with `11.1.1`. Installed Jayson `lib/generateRequest.js:3,49`, `lib/client/browser/index.js:3,30` and `lib/utils.js:6,52` use `v4()` without supplied buffers. The root app has no direct uuid imports. The inspected call path does not meet the advisory's affected method conditions. | Remains in npm audit; do not force an 8.x -> 11.x API change. [Maintainer advisory](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq) |

The 13 moderate nodes are Clerk JS; eight Solana wallet/mobile/standard adapter packages; `@solana/web3.js`; Jayson; stream-json; uuid. They are propagation of the two advisories above, not 13 separate proven vulnerabilities. The static root does use Clerk (`src/scripts/clerk.js:1`) and dynamically loads Clerk UI, so wallet dependencies must not be dismissed solely because the repository has no direct wallet imports. The deployed bundle, enabled wallet providers and production reachability were not instrumented by this dependency lane.

### Checks completed in this lane

- Official registry audits before and after changes, plus installed/lockfile version comparison and `npm ls` dependency-resolution checks.
- Web-next `npm test -- lib/auth/redirect.test.ts lib/landing/landing-i18n.test.ts lib/landing/accept-language.test.ts --maxWorkers=1`: **3 files / 28 tests passed** on Vitest `3.2.6`, repeated after the final esbuild refresh.
- Root `npm ls --depth=0` passed and Vite `6.4.3` successfully transformed an in-memory TypeScript sample through `transformWithEsbuild`; no full root build or asset-copy lifecycle ran in this lane.
- Web-next `npm ls --depth=0` exits zero but labels six optional WASM helpers as extraneous (`@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@img/sharp-wasm32`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`). Each is present in the lockfile with `optional: true`, and its installed version matches. Native Sharp works. They were not deleted while other lanes verify the shared installation; the clean CI install remains a release gate.
- In-memory Sharp AVIF encode/decode with dimension checks passed on `sharp@0.35.4` / libvips `8.18.6`; no external images or paid API calls used.
- PostCSS `8.5.23` with autoprefixer processed representative CSS successfully.
- Supabase, Groq, Upstash Redis/ratelimit and Sentry SDK imports passed without provider requests. Clerk's CommonJS package entry imported successfully. A plain Node dynamic-ESM Clerk import failed on an extensionless internal path; this standalone Node mode is not the Next bundler, and the final application build remains the real integration gate. Clerk's direct version was unchanged by this lane.
- Scoped diff review confirms no direct major upgrades. `git -c core.whitespace=cr-at-eol diff --check` passed: the web package files were already tracked as CRLF, which default `git diff --check` reports as trailing whitespace; their existing line endings were preserved.

The lead agent coordinates final typecheck, lint, full build and real-browser checks after dependency mutations finish. Those checks and production deployment are separate gates; no deployment is implied here.
