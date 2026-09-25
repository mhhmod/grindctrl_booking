05, the backend

Two things matter here. First, a bug that makes every paid storefront try-on fail today, including the demo store the landing page sends people to. Second, the contracts the new pages use, which already exist and mostly need no change. Fix the bug first, in its own branch from `main`, for example `fix/try-on-model-tier`, and its own pull request, so it can ship before the redesign is finished. It is urgent and has nothing to do with the redesign.

The bug. When a shopper presses Generate on a store, `lib/try-on/service.ts` picks the image model with `entitlement.modelKey || process.env.TRYON_MODEL || DEFAULT_MODEL` at about line 125. `entitlement.modelKey` is the plan's `model_key` column, read in `lib/try-on/entitlement.ts` at about line 444. That column only ever holds tier labels. The repo schema allows `lite` and `flash` (`supabase-migration-plans.sql`, lines 14 and 34, and the seeds at 245 to 254). Production was later changed outside the repo to plans that use `muse`, and the one existing subscriber, most likely the demo store, is still on `lite`. Because a label like `lite` is truthy, the environment variable and the default are never reached. `lib/try-on/image-runner.ts` then posts `model: "lite"` to OpenRouter's images endpoint, OpenRouter rejects it, the job fails with `provider_http_error`, the reserved credit is refunded, and the shopper sees that the try-on couldn't finish. This started with commit `3e284fa` on 13 September 2026, and it affects every paid storefront shop. The public `/try-on` page is not affected, because its non-billable path at about line 281 uses `process.env.TRYON_MODEL || DEFAULT_MODEL` directly. The tests missed it because `service.test.ts` mocks the default model and even asserts that a label passes through to the provider unchanged. Setting `TRYON_MODEL` alone does nothing. Rewriting the plan rows is blocked by the check constraint and by the trigger that freezes plans with subscribers.

The fix. Resolve a tier label to a real provider model id at the provider boundary, and keep recording the tier the shop is entitled to on the reservation as today. Add `lib/try-on/models.ts`:

```ts
export const DEFAULT_TRYON_MODEL = 'meta/muse-image';

const TIER_ENV: Record<string, string> = {
  lite: 'TRYON_MODEL_LITE',
  flash: 'TRYON_MODEL_FLASH',
  muse: 'TRYON_MODEL_MUSE',
};

const SLUG_RE = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i;

function envModel(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  if (!SLUG_RE.test(value)) throw new Error(`${name} must be a provider model id such as vendor/model`);
  return value;
}

export function defaultTryOnModel(): string {
  return envModel('TRYON_MODEL') ?? DEFAULT_TRYON_MODEL;
}

/** Turns a plan tier label (lite, flash, muse) into a provider model id. Never sends a label upstream. */
export function resolveTryOnModel(tier: string | null | undefined): string {
  const raw = tier?.trim();
  if (!raw) return defaultTryOnModel();
  if (SLUG_RE.test(raw)) return raw; // the row already holds a real id
  const envName = TIER_ENV[raw.toLowerCase()];
  if (!envName) console.error('[try-on] unknown_model_tier', { tier: raw });
  return (envName ? envModel(envName) : null) ?? defaultTryOnModel();
}

/** Called once at startup when TRYON_MODE=live, so a bad value fails the boot, not a shopper. */
export function assertTryOnModelConfig(): void {
  defaultTryOnModel();
  Object.values(TIER_ENV).forEach(envModel);
}
```

Then, in `service.ts`, delete the local `DEFAULT_MODEL`. In the billable branch, compute two values. `const entitledModel = entitlement.modelKey || defaultTryOnModel()` is what the shop is entitled to. It keeps going to `beginTryOnJob` and into `job.modelKey` exactly as today, so the reservation, the ledger and the tests that pin the no-plan default don't change, and `modelKey: string` still type-checks. `const providerModel = resolveTryOnModel(entitlement.modelKey)` is what the provider receives. Pass it to `runImageGeneration`, and use it for the `provider` field in the failure log and in the failed job's `meta.provider`, so logs name the model that was actually called. In the non-billable branch, use `defaultTryOnModel()`. In `instrumentation.ts`, inside `register()` for the Node runtime, call `assertTryOnModelConfig()` when `TRYON_MODE` is `live`. Before you merge, read the live definition of `reserve_tryon_credit` in the production database, because production was changed outside the repo once already. Confirm it only records `p_model_key` and doesn't validate it, as the repo version does at lines 589 to 685. If it does validate, pass the tier label to it, which the approach above already does.

Tests for the fix. Rewrite the parts of `lib/try-on/service.test.ts` that assert a label reaches the provider, roughly lines 154 to 227. They should now assert that `lite`, `flash` and `muse` resolve through their environment variables, that an unknown label falls back to the default and logs, that a real `vendor/model` id passes through, and that the reservation still receives the tier. Add `lib/try-on/models.test.ts` for the resolver and the startup assertion. Keep the existing refund and idempotency tests green.

Configuration. Add `TRYON_MODE`, `TRYON_MODEL`, `TRYON_MODEL_LITE`, `TRYON_MODEL_FLASH`, `TRYON_MODEL_MUSE` and `OPENROUTER_API_KEY` to `apps/web-next/.env.example` with comments. None of their values go in the repo. `.env.example` also lacks `SHOPIFY_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY`, which the try-on and chat routes need, so add those names too. Its Supabase project id `egvdxshlbcqndrcnzcdn` is stale, and the live project is `prsusuwxbzaekynonifl` according to `apps/web-next/docs/deployment.md`. `scripts/production-readiness-preflight.mjs`, at the repo root, defaults to a different model id than the runtime. Make it check every resolved id against OpenRouter's image model list, and confirm `meta/muse-image` is on that list before you deploy. The owner sets the real values in the deployment environment. Tell them in the pull request exactly which variables to set.

How to prove the fix. There is no staging environment. `deploy-next.yml` deploys only `main`, and the Shopify app proxy points only at `https://grindctrl.cloud`, so the demo store can only be tested against production. Prove it in three steps. First, the unit tests above must pass. Second, run the app locally with `TRYON_MODE=live` and keys the owner gives you (`OPENROUTER_API_KEY`, `SHOPIFY_API_SECRET` and the Upstash pair) and make a real look on `/try-on`. That proves the model id the provider now receives is valid. Third, after the fix is deployed, the owner opens the demo store at `https://grindctrl.myshopify.com` with password 1, opens a product, presses Try it on with AI, uploads a photo and presses Generate. The look must come back, and the ledger must show one debit for that job and no refund. Write these owner steps into the pull request. If the demo store has no active subscription or no credits left, the reservation fails before the provider is called. In that case the owner tops it up through the operator actions in the dashboard. Don't grant credits from code. Reading the live definition of `reserve_tryon_credit` also needs database access, so ask the owner to run `select pg_get_functiondef('reserve_tryon_credit'::regproc);` if you don't have it.

The public try-on API the new page uses. These routes already exist and need no change apart from accepting the four new demo products. They are listed here so you don't have to reverse engineer them. `POST /api/try-on/session` takes `{ productId, context: 'public-demo' }` and returns `{ ok, data: { sessionId, productId, garmentUrl, expiresAt, ... } }`, where `garmentUrl` is null for the public demo. The `sessionId` is a signed capability that lasts ten minutes. `POST /api/try-on/attempt` takes `{ sessionId, productId, attemptNonce }` and returns `{ ok, data: { attemptId, expiresAt } }`. It fixes one request key per press, so retries never double charge. `POST /api/try-on/generate` takes `{ sessionId, attemptId, productId, photoSource: 'upload', photoReference, photoData }`. Storefront sessions also send `storefrontNonce`, `variantId`, `garmentUrl` and `productName`, but a public demo session must leave those out, or the route answers 400. `photoData` must be a `data:image/jpeg`, `png` or `webp` base64 URL of at most 8 MB, and `productName` at most 120 characters. It returns `{ ok, jobId, status, resultImageUrl, productId, message, meta, code? }`, where `resultImageUrl` is a data URL. The call is synchronous with a 120 second provider timeout. It can answer 400, 401, 409 and 503. Out of credits answers HTTP 200 with `ok: false` and `code: 'TRYON_UNAVAILABLE'`. `GET /api/try-on/jobs/{jobId}` with `Authorization: Bearer <sessionId>` is polled while the status is queued or processing, or while the code is `TRYON_FINALIZATION_PENDING`. All routes need `SHOPIFY_API_SECRET` for signing and answer 503 without it. They also need Upstash, and fail closed with 503 without it. The public limit is 10 requests per 10 seconds per IP, and polling allows 90 per 2 minutes. Public demo results live only in memory. Paid storefront results also go to the private `tryon-results` bucket for 30 minutes, served through signed URLs that expire within 5 minutes.

The landing hero chat needs no backend. It is a labelled scripted demo. The real site assistant behind `AssistantLauncher` keeps using `/api/assistant/session` and `/api/assistant/chat` as today. The only change is that the launcher stays hidden while the landing story is pinned, as `01-system.md` says. Store Chat on real storefronts, including knowledge answers, read-only order status and handoff to the team inbox with an email, already exists under `lib/messenger` and the theme app extension, and this work doesn't touch it.

Known gaps you should not fix in this work, but should mention in the pull request. The storefront widget never hides itself when a shop runs out of credits, even though `/apps/grindctrl/config` already returns `available`, and the pricing FAQ says the widget stops showing. Tell the owner, because that answer is live on the pricing page. The logged-in customer order lookup needs the `read_customers` scope, which `shopify.app.toml` doesn't request. The n8n workflow JSON files and the old chat widget in `src/` belong to the legacy site and aren't used by `apps/web-next`.
