# Supported LTS; digest verified against the official library/node manifest.
# 2026-09-10: bumped 24.20.0 -> 24.21.0 (same alpine 3.24 base, rebuilt same day)
# to close Trivy findings the release-check gate caught: CVE-2026-14456
# (libcrypto3/libssl3 QUIC DoS) and CVE-2026-14257/69152/69192/73566 in npm's
# own bundled brace-expansion/ip-address/tar -- all fixed upstream, not app deps.
ARG NODE_IMAGE=node:24.21.0-alpine@sha256:333f6b3eca25980d5682c26207665b93c9417786b21760b2764d5821d9704c8a
FROM ${NODE_IMAGE} AS deps
WORKDIR /app/apps/web-next
COPY apps/web-next/package*.json ./
RUN npm ci

FROM ${NODE_IMAGE} AS builder
WORKDIR /app/apps/web-next
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
# Client-side config MUST be present at build time: Next inlines
# NEXT_PUBLIC_* into bundles during `next build`. Values passed at runtime
# are invisible to the browser, so missing build args silently disable
# client Sentry/PostHog (see deploy-next.yml, which supplies these from
# GitHub Actions secrets).
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
COPY --from=deps /app/apps/web-next/node_modules ./node_modules
COPY apps/web-next ./
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app/apps/web-next
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# ARG is scoped per stage, so the builder's SENTRY_RELEASE above never reached
# the runtime image: server-side Sentry events shipped untagged, and nothing
# running in production could report which commit it was. Re-declare it here so
# the container knows its own release (surfaced by /api/health, which the deploy
# workflow asserts against the SHA it just pushed).
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
# Alpine's own package repo publishes security fixes faster than the upstream
# node:alpine image gets rebuilt (e.g. libssl3/libcrypto3 CVE-2026-14456 was
# fixed in the v3.24 repo before any node:24-alpine build picked it up).
# Pick those up at build time instead of waiting on an upstream image bump.
RUN apk upgrade --no-cache
# npm ships bundled inside every node:*-alpine image regardless of whether a
# stage's own build steps use it. This stage never runs npm -- output:
# standalone's CMD is `node server.js` directly -- so npm's vendored deps
# (which is where CVE-2026-14257/69152/69192/73566 in brace-expansion/
# ip-address/tar live) are dead weight here: unused attack surface the
# release-check gate's Trivy scan correctly flags. Remove them; deps/builder
# above still have their own npm for the actual build.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
# next.config.ts sets output: 'standalone', which traces and copies only the
# production node_modules subset a request actually needs into .next/standalone
# — a fraction of the full dev node_modules the old `COPY .../web-next ./` +
# `next start` combination shipped. Static assets and public/ are deliberately
# left out of that trace (Next's own docs) and copied in separately below.
COPY --from=builder --chown=node:node /app/apps/web-next/public ./public
COPY --from=builder --chown=node:node /app/apps/web-next/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web-next/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
