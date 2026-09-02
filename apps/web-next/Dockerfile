FROM node:20-alpine AS deps
WORKDIR /app/apps/web-next
COPY apps/web-next/package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
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

FROM node:20-alpine AS runner
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
# next.config.ts sets output: 'standalone', which traces and copies only the
# production node_modules subset a request actually needs into .next/standalone
# — a fraction of the full dev node_modules the old `COPY .../web-next ./` +
# `next start` combination shipped. Static assets and public/ are deliberately
# left out of that trace (Next's own docs) and copied in separately below.
COPY --from=builder /app/apps/web-next/public ./public
COPY --from=builder /app/apps/web-next/.next/standalone ./
COPY --from=builder /app/apps/web-next/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
