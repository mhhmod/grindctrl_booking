FROM node:20-alpine AS deps
WORKDIR /app/apps/web-next
COPY apps/web-next/package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app/apps/web-next
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE
COPY --from=deps /app/apps/web-next/node_modules ./node_modules
COPY apps/web-next ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/apps/web-next
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
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
