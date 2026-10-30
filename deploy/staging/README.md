# Isolated GRINDCTRL staging

Target: **https://shopify-m1-dev.grindctrl.cloud**, on the existing VPS, authorized
2026-10-30. These are reviewable files only: no commit, push, SSH, DNS change or
deployment was performed by their author. No new paid service is required.

## Isolation and prerequisites

The only application change is a staging-only guard in Next's existing
`instrumentation.register`, before Sentry initializes. Production has no staging
marker and retains its current behavior. Staging uses its own Dockerfile so its
public Clerk/Supabase configuration is baked into the client bundle; runtime
values must match. `/api/health.release` remains the image's baked commit SHA.

| Resource | Staging only |
| --- | --- |
| Compose project / web container | `grindctrl-staging` / `grindctrl-staging-web` |
| Image | `ghcr.io/<owner>/<repo>-staging:<sha>`, deployed with its scanned digest |
| Runtime env | `/root/grindctrl-staging/.env.staging` (root, mode 600) |
| Router / service / middleware | `grindctrl-staging` / `grindctrl-staging` / `grindctrl-staging-noindex` |
| Networks | `grindctrl-staging-edge` (Traefik + web); `grindctrl-staging-data` (web + SRH + Redis, internal) |
| Persistent volume | `grindctrl-staging-redis-data` only |

Redis/SRH have no published ports or Traefik labels. The shared Traefik **must
already have `providers.docker.exposedByDefault=false`**, entrypoint `websecure`
on 443 and resolver `mytlschallenge`. Verify these with the existing operator
configuration; stop if they differ. Do not edit/restart production to compensate.
Connect Traefik to the dedicated staging edge network once; Redis stays on data.
Traefik's staging network attachment must be restored if Traefik is recreated.

The web limit is 1 GiB/0.75 CPU; Redis and SRH each 128 MiB/0.15 CPU, with swap
bounded to the same memory limits and capped logs. Confirm at least 1.25 GiB of
usable RAM headroom and **5 GiB free on Docker's disk** before proceeding.
The deploy script refuses a pull below the disk floor. There are no VPS builds.
It keeps the selected and previous staging SHA tags (at most two after cleanup);
a third may exist briefly during a pull. Only exact staging tags are removed,
without force or global prune. GHCR tags/cache are separate from VPS retention;
use existing free Actions/GHCR allowance and stop rather than enable paid usage.
An already-present SHA with a different digest is refused; rebuild a new reviewed
commit instead of mutating a deployed SHA. This also prevents dangling older
versions of the same staging tag from accumulating on the VPS.

The referenced `testing/shopify/local/README.md` and
`testing/shopify/test-runtime-intake.env.example` are absent on this branch.
They were read from the sibling `../app` worktree, along with `local/stack.py`:
the Redis/SRH digests and REST adapter settings match that local stack. This
deployment does **not** expose its local-only preview or copy its synthetic keys.

Before functional tests, the operator must verify an existing, separate TEST
Supabase project has the schema/RLS/storage this branch expects and **at most two
authorized Development Stores, 12 credits each**. Do not import production data,
apply the local harness's synthetic prerequisites to hosted Supabase, or run
production schedulers. No SQL is supplied/applied by this change. Disable other
plans/packs, free enrollment, renewals/top-ups and public registration in the TEST
environment before testing; confirm these controls in that database and Clerk
Development instance. Stop functional testing if that cannot be established.

`GRINDCTRL_TEST_SHOPS` is the existing intake name, checked at boot for at most two
domains; **it is not an application route/install allowlist** on this branch.
`TRYON_TEST_LOOKS_PER_DAY` is the existing daily test-look setting, not the total
credit budget. The boot guard does not seed or enforce database balances. Install
the TEST apps only on the authorized stores; keep Clerk signup restricted to
testers. Test execution remains limited to **24 mock attempts, two concurrent,
24 hours plus at most 15 minutes drain**, tracked across restarts by the operator
or the existing test harness. No fictitious environment quota is claimed here.
`TRYON_MODE=mock` uses the existing static-result runner: zero real provider calls
and zero provider concurrency (within the <=24/<=2 hard provider limits). It does
not exercise live debit/reserve/provider flows. Store Chat/voice AI is unavailable
without provider keys; those keys are deliberately refused. M1 live acceptance,
privacy fulfillment, tenant boundaries and authenticated journeys remain open.

## GitHub setup (no production secret values)

Create a GitHub environment named **`staging`**, limited to reviewed staging
branches and `ci/m1-staging` for the initial manual run. Workflow push triggers
are `staging/**`; `ci/m1-staging` needs `workflow_dispatch`. GitHub must know this
workflow on the default branch before a new workflow can be manually dispatched;
alternatively push the reviewed commit to `staging/m1` for its first run.

The workflow uses exactly these secret names:

| Secret | Status and value |
| --- | --- |
| `GITHUB_TOKEN` | Existing automatic job token; only build has `packages: write`. |
| `DEPLOY_HOST` | Existing name; set a staging-environment copy to the existing VPS host/IP. |
| `DEPLOY_USER` | Existing name; staging-environment value `root`, matching the approved server paths. |
| `DEPLOY_SSH_KEY` | Existing name, **new staging-environment credential**, dedicated key below. Never copy the production value. |

No new secret **names** are introduced. Do not change any repository production
secret. `deploy-next.yml` documents its key as forced to the production deploy
script: using that key here could execute production regardless of the command
sent. Environment-scoped `DEPLOY_SSH_KEY` overrides that repository secret.
The workflow verifies its public-key fingerprint **before opening any SSH
connection**; missing/wrong environment configuration fails instead of silently
falling back to the repository key. Record the staging key's distinct fingerprint.

Set these **non-secret environment variables** (GitHub Settings > Environments >
staging > Variables):

| Variable | Value |
| --- | --- |
| `STAGING_CLERK_PUBLISHABLE_KEY` | TEST `pk_test_...`, identical to `.env.staging`. |
| `STAGING_SUPABASE_URL` | Separate TEST project URL, identical to `.env.staging`. |
| `STAGING_SUPABASE_ANON_KEY` | TEST anon/publishable key only; never service-role key. |
| `STAGING_SSH_KEY_FINGERPRINT` | `SHA256:...` from the new staging public key. |
| `STAGING_SSH_KNOWN_HOSTS` | Verified OpenSSH known_hosts line for `DEPLOY_HOST`. Obtain the server public host key through the trusted VPS console/admin channel, not an unverified network scan. |

Runtime Clerk secret, Supabase service key, Shopify secrets and Redis credentials
stay only in the server env. The workflow neither reads nor prints that file.
For GHCR pulls, prefer a public staging package if its code/assets may be public.
For a private package, the operator must configure an existing read-only GHCR
credential privately on the VPS; the workflow does not add a PAT secret. Check
free storage/transfer allowance first. An inaccessible image fails before replace.
New GHCR packages may initially be private. After the first push, configure its
visibility/access if needed, then rerun the **failed deploy job**, preserving the
already-scanned digest rather than rebuilding that SHA.

## One-time operator steps

Use the owner's trusted administrative connection for bootstrap. Transfer the
reviewed `deploy/staging/` files to `/root/grindctrl-staging-review/` (LF endings).
Do not use the production deploy key. On the VPS, run:

```bash
set -euo pipefail
umask 077
install -d -m 700 /root/grindctrl-staging
install -m 755 /root/grindctrl-staging-review/deploy.sh /root/grindctrl-staging/deploy.sh
install -m 644 /root/grindctrl-staging-review/compose.yml /root/grindctrl-staging/compose.yml
test ! -e /root/grindctrl-staging/.env.staging
install -m 600 /root/grindctrl-staging-review/env.staging.example /root/grindctrl-staging/.env.staging
cd /root/grindctrl-staging
sha256sum compose.yml | cut -d ' ' -f 1 > compose.approved.sha256
# Replace with the actual lowercase GitHub owner/repository, including -staging.
printf '%s\n' 'ghcr.io/OWNER/REPO-staging' > image-repository
python3 - <<'PY'
import base64, pathlib, secrets
p = pathlib.Path('/root/grindctrl-staging/.env.staging')
s = p.read_text()
for placeholder, value in {
    'REPLACE_WITH_NEW_BASE64_32_BYTES': base64.b64encode(secrets.token_bytes(32)).decode(),
    'REPLACE_WITH_NEW_HEX_32_BYTES': secrets.token_hex(32),
    'REPLACE_WITH_DIFFERENT_NEW_HEX_32_BYTES': secrets.token_hex(32),
}.items():
    s = s.replace(placeholder, value)
p.write_text(s)
p.chmod(0o600)
PY
# Privately fill the remaining TEST placeholders, then close the editor.
editor /root/grindctrl-staging/.env.staging
chmod 600 /root/grindctrl-staging/.env.staging
bash -n /root/grindctrl-staging/deploy.sh
docker compose version # requires Compose v2.30+; Python 3, curl, flock also required
docker network create grindctrl-staging-edge
# Substitute the already-running Traefik container name, NOT grindctrl-next.
docker network connect grindctrl-staging-edge EXISTING_TRAEFIK_CONTAINER
```

Generate a **new**, passphrase-free Ed25519 deploy key on the trusted operator
workstation. Store its private half as the staging environment's `DEPLOY_SSH_KEY`;
store its public fingerprint as `STAGING_SSH_KEY_FINGERPRINT`. Add only its public
half to `/root/.ssh/authorized_keys`, on one new line with these exact options:

```text
restrict,command="/root/grindctrl-staging/deploy.sh" ssh-ed25519 REPLACE_STAGING_PUBLIC_KEY grindctrl-staging-only
```

Leave the production key's line unchanged. The forced script accepts only
`deploy-staging <40-hex-sha> <sha256:digest>` (stdin is the approved Compose file)
or `staging-logs`. It accepts no shell program, paths, env file, or production
target. The Compose SHA-256 allowlist is operator-owned; when that tracked file
changes, review and update the approved hash through the admin channel before
rerunning the workflow. The workflow cannot replace `deploy.sh`.

Add DNS **A `shopify-m1-dev` -> the existing VPS IPv4**. Remove any conflicting
AAAA record unless that address routes correctly to this VPS. DNS must resolve
directly to the existing Traefik on 443 so `mytlschallenge` can obtain the cert;
do not enable a proxy that terminates the TLS challenge elsewhere.

After GitHub variables/secrets and TEST database are ready, dispatch **Deploy
isolated staging** on the reviewed branch (or push a reviewed `staging/**` branch).
The workflow runs unit tests/typecheck, builds only on GitHub, pushes the SHA tag,
scans its exact digest, and copies approved Compose via SSH stdin. Server steps
serialize with a staging-only `flock`, preflight the runtime guard, then execute:

```bash
# .image.env is created by deploy.sh, contains only the immutable image and SHA.
export COMPOSE_ENV_FILES=/root/grindctrl-staging/.env.staging,/root/grindctrl-staging/.image.env
docker compose -p grindctrl-staging -f /root/grindctrl-staging/compose.yml up -d --no-build --wait --wait-timeout 180
curl --fail --silent --show-error -i https://shopify-m1-dev.grindctrl.cloud/api/health
```

Success requires `ok: true`, `release` equal to the pushed SHA, `X-Robots-Tag:
noindex, nofollow`, and a successful authenticated Redis PING through SRH. The
workflow never runs `compose config` without `--quiet`, dumps env, or prints raw
container logs. Failure leaves production alone and outputs redacted staging
logs (only guard variable names survive; all other lines are suppressed).
No automatic rollback occurs. Two branches can pass serialized host deployment
and still race the later public smoke check; a SHA mismatch fails safely. Use one
active staging release branch for clear evidence.

## Shopify TEST app configuration

Use a separate existing TEST registration. Do not edit
`apps/grindctrl-tryon/shopify.app.toml`. From that directory, link it explicitly:

```bash
shopify app config link --client-id TEST_A_CLIENT_ID --file-name grindctrl-test-a
# Edit only shopify.app.grindctrl-test-a.toml to the diff below, reviewing scopes.
shopify app deploy --config grindctrl-test-a
```

The following is the ready target diff **against a copy of the production TOML**,
saved as `shopify.app.grindctrl-test-a.toml`; substitute the TEST client ID. The
linked TEST configuration may have different pre-existing values, so compare
before applying. It preserves the existing scope/API-version/proxy path contract.
Repeat for a separately verified B registration only if available. If installing
alongside production in the same Development Store, `apps/grindctrl` can collide:
verify the app proxy assignment first; do not change production to resolve it.

```diff
diff --git a/shopify.app.grindctrl-test-a.toml b/shopify.app.grindctrl-test-a.toml
index be24ae7..154af8d 100644
--- a/shopify.app.grindctrl-test-a.toml
+++ b/shopify.app.grindctrl-test-a.toml
@@ -1,16 +1,16 @@
 # Learn more about configuring your app at https://shopify.dev/docs/apps/tools/cli/configuration
 
-client_id = "fc095fe656d9029fdc249a4af2315f19"
-application_url = "https://grindctrl.cloud/shopify/app"
+client_id = "TEST_A_CLIENT_ID"
+application_url = "https://shopify-m1-dev.grindctrl.cloud/shopify/app"
 embedded = true
-name = "GRINDCTRL"
+name = "GRINDCTRL TEST A"
 
 [access_scopes]
 # Learn more at https://shopify.dev/docs/apps/tools/cli/configuration#access_scopes
 scopes = "read_products,read_orders,write_app_proxy"
 
 [app_proxy]
-url = "https://grindctrl.cloud/api/shopify/proxy"
+url = "https://shopify-m1-dev.grindctrl.cloud/api/shopify/proxy"
 prefix = "apps"
 subpath = "grindctrl"
 
@@ -18,33 +18,30 @@ subpath = "grindctrl"
 api_version = "2026-07"
 
   [[webhooks.subscriptions]]
-  uri = "https://grindctrl.cloud/api/shopify/webhooks"
+  uri = "https://shopify-m1-dev.grindctrl.cloud/api/shopify/webhooks"
   topics = [ "app/uninstalled" ]
 
   [[webhooks.subscriptions]]
-  uri = "https://grindctrl.cloud/api/shopify/webhooks"
+  uri = "https://shopify-m1-dev.grindctrl.cloud/api/shopify/webhooks"
   topics = [ "app/scopes_update" ]
 
   [[webhooks.subscriptions]]
-  uri = "https://grindctrl.cloud/api/shopify/webhooks"
+  uri = "https://shopify-m1-dev.grindctrl.cloud/api/shopify/webhooks"
   compliance_topics = [ "customers/data_request" ]
 
   [[webhooks.subscriptions]]
-  uri = "https://grindctrl.cloud/api/shopify/webhooks"
+  uri = "https://shopify-m1-dev.grindctrl.cloud/api/shopify/webhooks"
   compliance_topics = [ "customers/redact" ]
 
   [[webhooks.subscriptions]]
-  uri = "https://grindctrl.cloud/api/shopify/webhooks"
+  uri = "https://shopify-m1-dev.grindctrl.cloud/api/shopify/webhooks"
   compliance_topics = [ "shop/redact" ]
 
 [auth]
-# Both hostnames serve the same app. OAuth must return to whichever one
-# the merchant started from, because the CSRF state cookie is bound to that
-# host — a callback on the other domain never receives it.
+# Staging only; OAuth state cookies stay on this exact host.
 redirect_urls = [
-  "https://grindctrl.cloud/shopify/app",
-  "https://grindctrl.cloud/api/shopify/oauth/callback",
-  "https://dashboard.grindctrl.cloud/api/shopify/oauth/callback"
+  "https://shopify-m1-dev.grindctrl.cloud/shopify/app",
+  "https://shopify-m1-dev.grindctrl.cloud/api/shopify/oauth/callback"
 ]
 
 [build]
```

See Shopify's official [config link command](https://shopify.dev/docs/api/shopify-cli/app/app-config-link)
and [app configuration reference](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration).
SRH settings follow its [upstream documentation](https://github.com/hiett/serverless-redis-http);
network/resource settings follow the [Compose reference](https://docs.docker.com/reference/compose-file/services/).

## Stop / rollback / removal

The safe rollback is to **take staging down**, retaining its TEST data:

```bash
export COMPOSE_ENV_FILES=/root/grindctrl-staging/.env.staging,/root/grindctrl-staging/.image.env
docker compose -p grindctrl-staging -f /root/grindctrl-staging/compose.yml down
```

To restore earlier code, deploy a new reviewed revert commit through the same
guard/scan/deploy workflow, or have the operator invoke the forced staging script
with the retained SHA and its original scanned digest. Do not rebuild/overwrite
an old SHA or invoke any production rollback script. For
complete removal, first disable this staging workflow/environment's deployments,
uninstall only the TEST Shopify apps, remove the staging DNS record, then:

```bash
export COMPOSE_ENV_FILES=/root/grindctrl-staging/.env.staging,/root/grindctrl-staging/.image.env
docker compose -p grindctrl-staging -f /root/grindctrl-staging/compose.yml down --volumes
docker network disconnect grindctrl-staging-edge EXISTING_TRAEFIK_CONTAINER
docker network rm grindctrl-staging-edge
repo=$(cat /root/grindctrl-staging/image-repository)
[[ "$repo" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+-staging$ ]] || exit 1
while IFS= read -r ref; do
  [[ "$ref" == "$repo:"* ]] || continue
  tag=${ref#"$repo:"}
  [[ "$tag" =~ ^[a-f0-9]{40}$ ]] || continue
  docker image rm "$ref" # no --force; conflicts require inspection
done < <(docker image ls "$repo" --format '{{.Repository}}:{{.Tag}}')
# Revoke ONLY the new staging key line and staging environment credentials.
# After retaining any needed TEST evidence, remove these exact staging paths:
rm -r -- /root/grindctrl-staging /root/grindctrl-staging-review
```

Delete only the `-staging` GHCR package if desired. Do not remove shared Node,
Redis or SRH image digests globally, touch Traefik's certificates, prune Docker
globally, or remove a Supabase/Clerk resource shared with any other test. Supabase
TEST data and Clerk TEST users require their own owner-approved cleanup.
