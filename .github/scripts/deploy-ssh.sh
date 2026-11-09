#!/usr/bin/env bash
# Runs the VPS deploy over plain OpenSSH. The host must present one of the
# VPS's own host keys below (read from /etc/ssh on the server, not scanned
# over the network), so a man-in-the-middle cannot receive the session.
# The key is restricted server-side by authorized_keys `command=` to
# /root/grindctrl-next/deploy-next.sh. Rotate the lines here if the VPS
# host keys are ever regenerated.
set -euo pipefail
: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_SSH_KEY:?}"
dir=$(mktemp -d); trap 'rm -rf "$dir"' EXIT
umask 077
printf '%s\n' "$DEPLOY_SSH_KEY" > "$dir/key"
{
  echo "$DEPLOY_HOST ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPyeRkhQArWwXeWUD/I6R6vKRllAomDQEKCAuVkU0+Ek"
  echo "$DEPLOY_HOST ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBBUU5WZglN5ndnCeLQQ92To7Z4uXw4iRrcGumt0yGnRaapXw60S8JHYgYJk1KWv115VvH/xClx2Mk8A1wYPyQ8o="
} > "$dir/known_hosts"
# 15 minutes: this step is mostly a docker pull of a large image.
timeout 15m ssh -i "$dir/key" -o BatchMode=yes -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$dir/known_hosts" \
  -o ConnectTimeout=30 -o ServerAliveInterval=30 -o ServerAliveCountMax=4 \
  "$DEPLOY_USER@$DEPLOY_HOST" /root/grindctrl-next/deploy-next.sh
