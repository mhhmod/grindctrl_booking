# Platform readiness — milestone 1

Latest decision: **APPROVE WITH CHANGES** at `1c5f31a`, final approval pending; PR remains Draft. The [controlled-test decision report](2026-10-24-shopify-controlled-test-decision.md) records new source `77ae80e`, passing full CI (3,248 tests/334 files; 207 browser tests), zero remaining critical development findings, five residual development findings and the isolated-test authorization packet. No platform E2E status in this matrix is upgraded by those automated checks. Privacy Fulfillment remains P0 for merchant launch.

Local implementation evidence only. No real merchant onboarding or production migration occurred. Verified unit/SQL tests are not end-to-end installation verification. Current external settings are unavailable to this environment.

| Platform | Installation | Chat | Try-On | Products | Cart | Orders | Credits | End-to-end tested |
|---|---|---|---|---|---|---|---|---|
| Shopify Custom | Implemented, untested on real store after changes | Implemented, E2E unverified | Implemented, E2E unverified | Implemented, E2E unverified | Existing implementation, E2E unverified | Implemented; actual scopes/protected fields unverified | Existing implementation retained; local regressions passed | No |
| Shopify Public | App Store review required; actual review/configuration status unverified | Existing core, E2E unverified | Existing core, E2E unverified | Adapter implemented, unverified | Existing implementation, E2E unverified | Permissions/review not verified | Existing entitlements retained; paid billing deferred | No |
| WooCommerce | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |
| Wix | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |
| BigCommerce | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |
| Magento | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |
| PrestaShop | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |

Merchant pilot verdict: **NO-GO** until independent audit, reviewed migrations/configuration, privacy scope/retention and Development Store E2E evidence. Billing integration is not part of milestone 1. No capability stub is described as a complete integration. Milestones 2+ have not begun.

During two-app overlap, authenticated embedded operations carry the signing app's identity. Credential-dependent store-level operations without app context (including standalone theme/admin links) fail closed when multiple active installations exist; this is a known compatibility limit, not verified full availability. New Try-On work additionally requires the signing installation to remain active. Existing reserved-job recovery is preserved with local mocked orchestration evidence; actual ledger reconciliation remains unverified.

Separate merge, staging, production-migration and merchant-onboarding recommendations appear in the [engineering report](2026-10-24-shopify-m1.md#independent-release-recommendations). The [Development Store acceptance plan](2026-10-24-shopify-m1-runbook.md#development-store-acceptance-plan--not-executed) is prepared and has not been executed.

Independent review did not approve M1 at `2093402`. Runtime/SQL remediation and remaining operating/toolchain gates are tracked in the [review-remediation report](2026-10-24-shopify-review-remediation.md). Configurable proxy paths and privacy casework are locally implemented; neither is evidence of real Shopify coexistence or actual privacy fulfillment.
