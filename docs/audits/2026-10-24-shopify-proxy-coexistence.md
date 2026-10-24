# App Proxy coexistence — configuration and unexecuted platform acceptance

Actual same-store Shopify compatibility is **unverified**. No app registrations, Shopify settings, extensions or stores were changed. Local tests simulate signed requests and execute storefront JavaScript; they cannot establish Shopify's actual proxy routing or extension release behavior.

[Shopify documents](https://shopify.dev/docs/apps/build/online-store/app-proxies) one proxy root per app, with child routes below it, the `write_app_proxy` scope and merchant-customizable prefix/subpath. Changes to prefix/subpath in configuration apply to new installations; existing store paths must be inspected separately. Two registrations must not be assumed to own the same storefront URL. The checked-in app currently declares `/apps/grindctrl`; all old loaders also hardcoded that path. That was a real coexistence limitation.

## Required configuration, without changing the existing registration

| Setting | Custom A | Public B in legitimate Development Store testing |
|---|---|---|
| Registration/client secret | Existing verified A identity/secret | Distinct B identity/secret; actual distribution/review state inspected independently |
| Embedded application URL | `https://<approved-host>/shopify/app/<A_CLIENT_ID>` (original base entry remains available for sole-app configuration) | `https://<approved-host>/shopify/app/<B_CLIENT_ID>` |
| OAuth callback | Approved same-host `/api/shopify/oauth/callback` | B's separately allowlisted same-host callback |
| App Proxy backend | `https://<approved-host>/api/shopify/proxy` | Same backend |
| App Proxy prefix/subpath | `apps` / `grindctrl`, **if actual existing store configuration confirms it** | `apps` / `grindctrl-public`, **if available and actually assigned to B** |
| Declared scopes | Existing scopes; actual `write_app_proxy`/`read_products` grants verified | B's own actual grants verified; no reuse of A's grants |
| Extension release | A's own published/test release and extension identity | A separate B release; extension placement does not transfer |
| Product Try-On block: Store connection path | `/apps/grindctrl` or A's actual merchant-customized path | `/apps/grindctrl-public` or B's actual customized path |
| Catalog embed: Store connection path | Same A path | Same B path |
| Store Chat embed: Store connection path | Same A path | Same B path |

These are requirements/examples, not claims that the configured paths already exist or are available. Do not generate installation links or change distribution as part of validation without authorization. An unapproved Public app remains restricted to legitimate testing; this configuration does not permit unrelated merchant self-installation.

Each registration's TOML would contain its own client ID/application URL plus:

```toml
# A: preserve its actual existing root. B: use a distinct available root.
[app_proxy]
url = "https://<approved-host>/api/shopify/proxy"
prefix = "apps"
subpath = "grindctrl-public" # B example; A remains grindctrl
```

Do not copy this example over the existing checked-in app configuration. Check URL allowlists, scopes, installed versions and each store's customized root first. A Shopify configuration change or extension release requires separate authorization.

The three Liquid blocks now expose a connection-path field and pass it to the existing loaders. Product config/proof, catalog config/proof and shopper identity use that root. Default `/apps/grindctrl` preserves existing single-app installations; B requires an explicit path. Values are restricted to a same-origin root with an allowed Shopify prefix and a 1–30 character slug. URLs, protocol-relative paths, traversal/query fragments fail closed. The path config chooses transport only: backend authorization still derives the app from its verified signature and checks installation state.

## Supported overlap arrangement and limits

Keep both registrations installed while independently authorizing them. Use **one storefront publisher at a time**: one registration's product block/catalog embed/chat embed. Do not enable duplicate A+B catalog/chat loaders on the same page and assume they merge; those existing page-wide launchers/storage/listeners were not redesigned. Configure and test B's widgets on a duplicate, unpublished test theme before switching the active publisher. After a separately authorized cutover, disable A's blocks and publish B's blocks with B's real paths. This is an assisted procedure, not a new automated theme migration.

Embedded operations carry verified app identity. Store-level standalone operations lacking app context deliberately fail on two active installations; this remains a documented compatibility limit. App Proxy endpoints must never guess based on the first configured registration, a browser-provided app ID, or a token from the other app. Cart/catalog endpoints native to the store keep their existing same-origin behavior.

## Acceptance tests — NOT executed on Shopify

After independent source review and explicit authorization for the named Development Store/settings/test theme, capture release SHA, A/B IDs, extension versions, actual roots and actual scope grants without secrets.

1. With A only, confirm the original widgets and default root still work. Verify config, product/variant/images, context exchange and shopper identity with synthetic customers; preserve merchant IDs/subscription/ledger snapshots.
2. Install/authorize B through its legitimate test method. Confirm independent installation UUIDs/tokens. Inspect the actual Shopify-assigned roots for **both** apps. If either root collides or changes, stop and fix approved configuration; do not assume which app wins routing.
3. On an unpublished theme, load A's three widgets alone, configured to A's actual root. Observe actual same-origin config/proof/identity requests. Restricted backend evidence must show A provenance/product authorization, not B's credentials.
4. Repeat with B widgets alone and B's actual root. Verify all three loaders use B's root, and a logged-in synthetic customer's verified identity is bound to B. Do not expose signed tokens or protected customer data in screenshots/logs.
5. Customize a test proxy path through an authorized Shopify operation and update all three relevant block fields. Verify the old path fails safely and the actual new route works. A TOML change alone is not evidence for existing installations.
6. Locally tamper with signatures, app audience, proxy shop/path parameters and configured external/traversal URLs. Verify rejection/no external fetch/no wrong-app credential use. Signed proof from B must not verify under A's secret.
7. Keep B authorized, uninstall A in the authorized test environment, deliver delayed/duplicate/altered-header A events in isolation and observe current-credential verification. B's token/version, backend product/identity operations and B-published widgets must remain functional. Scope events cannot reactivate A.
8. Reinstall A; replay its old signed body under new delivery IDs/timestamps. A's current valid credential must survive. Check active probe outcome and SQL fence evidence, not just an HTTP 200 receipt.
9. Verify cart actions, dashboard/settings, credit reservation/reconciliation and a paused noncharging Try-On stub across publisher cutover. Keep old verification configuration through the short-lived in-flight capability drain. No paid AI or payment calls are authorized.
10. Record `Passed`, `Failed` or `Blocked` for every scenario and exact registration/path/theme/release. Until this evidence exists, same-store proxy/Theme Extension compatibility remains **Implemented locally, platform E2E unverified** and merchant rollout stays NO-GO.

Local automated coverage verifies configured/default product paths, catalog B path, shopper-identity B path, invalid external/path inputs and B-specific signed proof/product provenance. It does not certify steps 1–10 on Shopify.
