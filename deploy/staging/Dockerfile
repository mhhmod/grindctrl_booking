# Separate build recipe: production Dockerfiles and build inputs stay unchanged.
# Same Node pin/standalone layout as apps/web-next/Dockerfile.
ARG NODE_IMAGE=node:24.21.0-alpine@sha256:333f6b3eca25980d5682c26207665b93c9417786b21760b2764d5821d9704c8a
FROM ${NODE_IMAGE} AS deps
WORKDIR /app/apps/web-next
COPY apps/web-next/package*.json ./
RUN npm ci

FROM ${NODE_IMAGE} AS builder
WORKDIR /app/apps/web-next
ARG SENTRY_RELEASE
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SENTRY_RELEASE=$SENTRY_RELEASE \
    NEXT_PUBLIC_APP_URL=https://shopify-m1-dev.grindctrl.cloud \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SENTRY_DSN="" NEXT_PUBLIC_POSTHOG_KEY="" NEXT_PUBLIC_POSTHOG_HOST="" \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/apps/web-next/node_modules ./node_modules
COPY apps/web-next ./
RUN node --experimental-strip-types --input-type=module -e "import {assertStagingBuildEnv} from './lib/staging-env.ts'; assertStagingBuildEnv(process.env)"
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app/apps/web-next
ARG SENTRY_RELEASE
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 GRINDCTRL_ENV=staging \
    NEXT_TELEMETRY_DISABLED=1 SENTRY_RELEASE=$SENTRY_RELEASE \
    STAGING_BUILT_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    STAGING_BUILT_NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    STAGING_BUILT_NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN apk upgrade --no-cache && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --from=builder --chown=node:node /app/apps/web-next/public ./public
COPY --from=builder --chown=node:node /app/apps/web-next/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web-next/.next/static ./.next/static
# A raw copy allows preflight of the full server env before replacing staging.
COPY --from=builder --chown=node:node /app/apps/web-next/lib/staging-env.ts ./staging-env.ts
USER node
EXPOSE 3000
CMD ["node", "server.js"]
