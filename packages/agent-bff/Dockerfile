FROM postgres:16-alpine AS deps

RUN apk add --no-cache nodejs npm \
  && npm install --global pnpm@10.33.2 \
    --registry=https://registry.npmmirror.com

WORKDIR /app

# The lockfile uses pnpm workspace catalogs, so it must be built from the
# repository root even though only agent-bff is installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/agent-bff/package.json ./packages/agent-bff/package.json

RUN --mount=type=cache,id=agent-bff-pnpm-store,target=/pnpm/store \
  pnpm install --prod --frozen-lockfile --filter ./packages/agent-bff

FROM postgres:16-alpine AS runtime

RUN apk add --no-cache nodejs su-exec tini \
  && addgroup -S -g 10001 app \
  && adduser -S -D -H -u 10001 -G app app

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV PGDATA=/var/lib/postgresql/data/pgdata

COPY --from=deps --chown=app:app /app/node_modules ./node_modules
COPY --from=deps --chown=app:app /app/packages/agent-bff/node_modules ./packages/agent-bff/node_modules
COPY --chown=app:app packages/agent-bff/package.json ./packages/agent-bff/package.json
COPY --chown=app:app packages/agent-bff/src ./packages/agent-bff/src
COPY --chown=app:app packages/agent-bff/migrations ./packages/agent-bff/migrations
COPY --chown=root:root packages/agent-bff/docker-entrypoint.sh /usr/local/bin/agent-entrypoint.sh

RUN mkdir -p /app/packages/agent-bff/uploads \
  && chown app:app /app/packages/agent-bff/uploads \
  && chmod +x /usr/local/bin/agent-entrypoint.sh

WORKDIR /app/packages/agent-bff

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 4000}/health`).then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/agent-entrypoint.sh"]
