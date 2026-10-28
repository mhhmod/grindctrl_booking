# Executable local M1 validation

Zero-cost Docker fallback authorized by `mhhmod` (owner/operator/recovery owner).
No hosted resource, management credential, production write, merge or M2.
Solo-owner execution is not independent human approval. PR #75 stays Draft.

```sh
# From the repository, with locked app dependencies and local Docker available:
python3 -m unittest discover -s testing/shopify/local -p 'test_*.py' -v
python3 testing/shopify/local/stack.py up
python3 testing/shopify/local/stack.py test
python3 testing/shopify/local/stack.py rehearse
# After a credential-free build in apps/web-next, optional local UI:
python3 testing/shopify/local/stack.py preview
python3 testing/shopify/local/stack.py stop
```

Pinned official PostgreSQL/PostgREST/Storage API/Node images; database, REST,
storage and app have only an internal Docker network. A credential-free router
with fixed upstreams publishes loopback ports 54380 (REST/storage) and 3102 (app).
Only this router has an ingress network: Docker 28 does not publish ports on an
internal-only container. The app has no socket, host network or external network.

Private state lives in the sibling `work/grindctrl-m1-local` directory, outside
Git/build context. Existing state/budget cannot be overwritten. Stop and retain
the old target before a fresh full run. Never reset the budget: <=24 synthetic
provider calls, <=2 concurrent, <=24h plus <=15m drain, shared with the preview.

**Real:** unchanged ledger/activation/reservation/finalization/refund SQL,
PostgreSQL transactions/locks, Supabase JS, PostgREST, private Storage objects,
SQL restore and fresh-worker result recovery after actual service restart.
**Synthetic:** A/B credentials, shops, Shopify responses, shopper claims and AI.
There is no actual Shopify OAuth or Clerk login, nor any paid provider call.

`prerequisites.sql` defines two undocumented historical tables from application
contracts. Financial functions are loaded unchanged in the explicit `DELTAS`
order. This is a usable disposable contract schema, **not a verified Production
baseline**. Never apply local prerequisites to a hosted/existing database.
Clerk/workspace/messenger schema and hosted drift remain unverified. The real
activation RPC issues 12 credits/store; other plans/packs are inactive. No
payment, automatic free enrollment, renewal, top-up or scheduler runs.

`rehearse` saves SQL and objects separately, restores SQL into a second disposable
database, compares ledger/job/installation/privacy counts, restarts DB/REST/storage
and launches a fresh worker. It proves no duplicate debit/provider call. A
separate restored Storage API instance/file restore and actual Shopify rollback
are not claimed. Keep dumps/objects/synthetic capabilities private.

The preview boots the actual standalone app. Missing Clerk/Redis/Shopify retain
their original fail-closed behavior. `http://127.0.0.1:3102` is **not shareable**
and is not a working merchant installation. Never publicly deploy this profile.

## Fourteen real acceptance gates

Every live-platform result remains **BLOCKED** until genuine Development Store,
A/B registrations, runtime credentials and an approved HTTPS preview are accessible.
Local evidence supports these gates; it does not replace live acceptance.

| Step | Local supporting evidence | Required genuine evidence |
|---|---|---|
| 1 | Additive SQL, RLS, bounded seed, SQL restore/object backup | Captured baseline parity and complete runtime schema |
| 2 | Encrypted credential RPCs | A install/OAuth and legacy reconnect |
| 3 | Separate store/credential mappings | Two authenticated store owners/tenant boundaries |
| 4 | Independent A/B rows; four browser initializer checks | Actual App Bridge/session tokens for both |
| 5 | Concurrent refresh leases, rotation, 429 preservation | Provider-defined expiring token lifecycle |
| 6 | Existing source guards | Real proxy coexistence/extensions/theme placement |
| 7 | Live-path Try-On/ledger/storage and app boot | Dashboard/Chat/catalog/cart/analytics with real auth/platform |
| 8 | App-specific missing-order-scope denial | Protected order/customer permission behavior |
| 9 incl. 9b | A-only revocation/B retained; expired/revoked receipt unresolved | Actual uninstall and authoritative reconciliation if needed |
| 10 | Reinstall/replay/unsigned future metadata fencing | Actual reinstall and delayed deliveries |
| 11 | Reserved settlement, one refund, fresh-worker recovery | Authorized storefront jobs during real transition |
| 12 | All privacy topics remain pending in durable queue | Actual delivery; fulfilled privacy remains P0 for launch |
| 13 | SQL/storage denial, native AI/Production egress denied | Real identity/origin/SSRF and operational failures |
| 14 | SQL restore/restart with ledger/budget retained | Approved platform rollback, drain and live signoff |

Five accepted development dependency risks retain the isolated-only restrictions
and production remediation gate. No watch/HMR/dev UI/MCP, untrusted registries,
arbitrary code/CSS generation or public exposure is permitted by this profile.
