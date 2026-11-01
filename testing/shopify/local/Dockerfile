# Local-only packaging of the fresh credential-free standalone build.
# No registry push, SSH, production base image or dependency install.
FROM node:24.21.0-alpine@sha256:333f6b3eca25980d5682c26207665b93c9417786b21760b2764d5821d9704c8a
WORKDIR /app/apps/web-next
ARG SOURCE_SHA
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 SENTRY_RELEASE=$SOURCE_SHA
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
COPY --chown=node:node standalone/ ./
COPY --chown=node:node public/ ./public/
COPY --chown=node:node static/ ./.next/static/
COPY --chown=node:node harness/ /opt/m1-local/
USER node
ENTRYPOINT ["node","--import","/opt/m1-local/preview-preload.mjs","server.js"]
