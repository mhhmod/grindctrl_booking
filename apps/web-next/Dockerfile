FROM node:20-alpine AS deps
WORKDIR /app/apps/web-next
COPY apps/web-next/package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app/apps/web-next
COPY --from=deps /app/apps/web-next/node_modules ./node_modules
COPY apps/web-next ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/apps/web-next
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/apps/web-next ./
EXPOSE 3000
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
