# Platform readiness — milestone 1

Local implementation evidence only. No real merchant onboarding or production migration occurred. Verified unit/SQL tests are not end-to-end installation verification. Current external settings are unavailable to this environment.

| Platform | Installation | Chat | Try-On | Products | Cart | Orders | Credits | End-to-end tested |
|---|---|---|---|---|---|---|---|---|
| Shopify Custom | Implemented, untested on real store after changes | Implemented, E2E unverified | Implemented, E2E unverified | Implemented, E2E unverified | Existing implementation, E2E unverified | Implemented; actual scopes/protected fields unverified | Existing implementation retained; local regressions required | No |
| Shopify Public | Blocked by platform review; configuration unverified | Existing core, E2E unverified | Existing core, E2E unverified | Adapter implemented, unverified | Existing implementation, E2E unverified | Permissions/review not verified | Existing entitlements retained; paid billing deferred | No |
| WooCommerce | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |
| Wix | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |
| BigCommerce | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |
| Magento | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |
| PrestaShop | Not implemented | Not implemented as an integration | Not implemented as an integration | Not implemented | Not implemented | Not implemented | Shared core exists; integration not implemented | No |

Merchant pilot verdict: **NO-GO** until independent audit, reviewed migrations/configuration, privacy scope/retention and Development Store E2E evidence. Billing integration is not part of milestone 1. No capability stub is described as a complete integration. Milestones 2+ have not begun.
