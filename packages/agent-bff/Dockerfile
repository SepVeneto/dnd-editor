# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable \
  && corepack prepare pnpm@10.33.2 --activate

WORKDIR /app

# The lockfile uses pnpm workspace catalogs, so it must be built from the
# repository root even though only agent-bff is installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/agent-bff/package.json ./packages/agent-bff/package.json

RUN --mount=type=cache,id=agent-bff-pnpm-store,target=/pnpm/store \
  pnpm install --prod --frozen-lockfile --filter ./packages/agent-bff

FROM node:22-alpine AS runtime

RUN apk add --no-cache tini \
  && addgroup -S app \
  && adduser -S app -G app

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=deps --chown=app:app /app/packages/agent-bff/node_modules ./packages/agent-bff/node_modules
COPY --chown=app:app packages/agent-bff/package.json ./packages/agent-bff/package.json
COPY --chown=app:app packages/agent-bff/src ./packages/agent-bff/src

RUN mkdir -p /app/packages/agent-bff/uploads \
  && chown app:app /app/packages/agent-bff/uploads

WORKDIR /app/packages/agent-bff

USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 4000}/health`).then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/main.js"]
