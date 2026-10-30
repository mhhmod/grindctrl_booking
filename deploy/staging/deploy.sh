#!/usr/bin/env bash
# Installed/reviewed by the operator, NOT overwritten by the workflow.
# authorized_keys: restrict,command="/root/grindctrl-staging/deploy.sh" ssh-ed25519 ...
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd /root/grindctrl-staging

redact() {
  # Fail closed: only boot-guard variable names survive. Arbitrary app messages,
  # request bodies, stack traces and all credential values are suppressed.
  sed -nE 's/.*(Staging environment refused: [A-Z][A-Z0-9_]*).*/\1/p; /Staging environment refused: [A-Z][A-Z0-9_]*/!s/.*/[redacted staging log line]/p'
}
logs() {
  docker logs --tail 80 grindctrl-staging-web 2>&1 | redact || true
}

if [[ "${SSH_ORIGINAL_COMMAND:-}" == staging-logs ]]; then
  logs
  exit 0
fi
if [[ ! "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy-staging\ ([a-f0-9]{40})\ (sha256:[a-f0-9]{64})$ ]]; then
  echo 'Only deploy-staging SHA DIGEST or staging-logs is allowed.' >&2
  exit 1
fi
sha=${BASH_REMATCH[1]}
digest=${BASH_REMATCH[2]}
# Per-branch GHA groups share one target; serialize across branches on the host.
exec 9>/root/grindctrl-staging/.deploy.lock
flock -w 900 9

repo=$(cat image-repository)
[[ "$repo" =~ ^ghcr\.io/[a-z0-9._-]+/[a-z0-9._-]+-staging$ ]]
[[ -f .env.staging && ! -L .env.staging ]]
[[ "$(stat -c '%a:%u' .env.staging)" == 600:0 ]]
# Prevent dotenv from overriding the immutable build identity or Compose controls.
if grep -Eq '^[[:space:]]*(export[[:space:]]+)?(SENTRY_RELEASE|STAGING_BUILT_[A-Z_]+|STAGING_IMAGE|STAGING_TAG|COMPOSE_[A-Z_]+)[[:space:]]*=' .env.staging; then
  echo 'Reserved deployment variable found in staging env; refusing.' >&2
  exit 1
fi

work=$(mktemp -d /root/grindctrl-staging/.deploy.XXXXXXXX)
prune_staging() {
  local current previous ref tag image_repo image_digest protected='' count=0
  current=$(sed -n 's/^STAGING_TAG=//p' .image.env 2>/dev/null || true)
  previous=$(cat .previous-tag 2>/dev/null || true)
  while IFS= read -r ref; do
    [[ "$ref" == "$repo:"* ]] || continue
    tag=${ref#"$repo:"}
    [[ "$tag" =~ ^[a-f0-9]{40}$ ]] || continue
    if [[ "$tag" != "$current" && "$tag" != "$previous" ]]; then
      # Exact staging repository:tag, never IDs, --force, system/image prune,
      # production tags, volumes, or another container's cleanup.
      docker image rm "$ref" >>"$work/operations.log" 2>&1 || return 1
    fi
  done < <(docker image ls "$repo" --format '{{.Repository}}:{{.Tag}}')
  # A failed pull/tag can leave a digest-only reference. Remove only this
  # repository's untagged digests, preserving both retained images' digests.
  for tag in "$current" "$previous"; do
    [[ "$tag" =~ ^[a-f0-9]{40}$ ]] || continue
    protected+=$(docker image inspect "$repo:$tag" --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null || true)
    protected+=$'\n'
  done
  while read -r image_repo tag image_digest; do
    [[ "$image_repo" == "$repo" && "$tag" == '<none>' && "$image_digest" =~ ^sha256:[a-f0-9]{64}$ ]] || continue
    ref="$repo@$image_digest"
    if ! grep -Fxq "$ref" <<< "$protected"; then
      docker image rm "$ref" >>"$work/operations.log" 2>&1 || return 1
    fi
  done < <(docker image ls "$repo" --digests --format '{{.Repository}} {{.Tag}} {{.Digest}}')
  count=$(docker image ls "$repo" --format '{{.ID}}' | sort -u | awk 'END {print NR}')
  [[ "$count" -le 2 ]]
}
finish() {
  local result=$?
  trap - EXIT
  if ! prune_staging; then
    echo 'Staging-only image retention needs operator attention; no forced deletion.' >&2
    result=1
  fi
  if [[ "$result" != 0 ]]; then
    echo 'Staging deploy failed; no production or automatic rollback commands were run.' >&2
    if [[ -f "$work/operations.log" ]]; then tail -n 30 "$work/operations.log" | redact; fi
    logs
  fi
  # work is created above with a fixed absolute parent, never caller-supplied.
  rm -r -- "$work"
  exit "$result"
}
trap finish EXIT

# Accept only the operator-reviewed manifest, at a fixed destination; no tar,
# paths, shell program or env values can be supplied over SSH.
python3 -c 'import sys; b=sys.stdin.buffer.read(32769); assert 0 < len(b) <= 32768; open(sys.argv[1],"wb").write(b)' "$work/compose.yml"
approved=$(cat compose.approved.sha256)
[[ "$approved" =~ ^[a-f0-9]{64}$ ]]
[[ "$(sha256sum "$work/compose.yml" | cut -d ' ' -f 1)" == "$approved" ]]

# Pulling still needs headroom; never build on the VPS or reclaim global disk.
docker_root=$(docker info --format '{{.DockerRootDir}}')
available_kb=$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')
if [[ "$available_kb" -lt 5242880 ]]; then
  echo 'Less than 5 GiB free on Docker disk; refusing staging pull.' >&2
  exit 1
fi
# Never retag a different image under an already-used SHA: that would leave
# untagged staging images behind and make a rollback's identity ambiguous.
if docker image inspect "$repo:$sha" --format '{{json .RepoDigests}}' > "$work/digests.json" 2>/dev/null; then
  python3 -c 'import json,sys; assert sys.argv[2] in (json.load(open(sys.argv[1])) or [])' "$work/digests.json" "$repo@$digest"
fi
docker pull "$repo@$digest" >"$work/operations.log" 2>&1
docker tag "$repo@$digest" "$repo:$sha"
printf 'STAGING_IMAGE=%s:%s@%s\nSTAGING_TAG=%s\n' "$repo" "$sha" "$digest" "$sha" > "$work/image.env"
candidate=(docker compose --env-file /root/grindctrl-staging/.env.staging --env-file "$work/image.env" -p grindctrl-staging -f "$work/compose.yml")
"${candidate[@]}" config --quiet >>"$work/operations.log" 2>&1
# Full runtime guard on the exact candidate BEFORE replacing staging. This run
# starts no dependencies/server and explicitly opts out of Traefik discovery.
"${candidate[@]}" run --rm --no-deps -T --name grindctrl-staging-preflight --label traefik.enable=false --entrypoint node web \
  --experimental-strip-types --input-type=module -e \
  'import {assertStagingEnv} from "./staging-env.ts"; if(process.env.GRINDCTRL_ENV!=="staging"||process.env.SENTRY_RELEASE!==process.argv[1])throw Error("Staging identity mismatch"); assertStagingEnv(process.env)' \
  "$sha" >>"$work/operations.log" 2>&1

if [[ -f .image.env ]]; then
  old_sha=$(sed -n 's/^STAGING_TAG=//p' .image.env)
  if [[ "$old_sha" != "$sha" ]]; then printf '%s\n' "$old_sha" > .previous-tag; fi
fi
install -m 600 "$work/image.env" .image.env
install -m 644 "$work/compose.yml" compose.yml
export COMPOSE_ENV_FILES=/root/grindctrl-staging/.env.staging,/root/grindctrl-staging/.image.env
docker compose -p grindctrl-staging -f /root/grindctrl-staging/compose.yml up -d --no-build --wait --wait-timeout 180 >>"$work/operations.log" 2>&1
# The image's health route does not exercise Redis. Verify the real adapter
# separately, with credentials read inside the container and no response dump.
docker exec grindctrl-staging-web node --input-type=module -e \
  'const r=await fetch(process.env.UPSTASH_REDIS_REST_URL,{method:"POST",headers:{Authorization:`Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify(["PING"]),signal:AbortSignal.timeout(5000)});const j=await r.json();if(!r.ok||j.result!=="PONG")process.exit(1)' \
  >>"$work/operations.log" 2>&1
echo "Staging candidate started: $sha"
