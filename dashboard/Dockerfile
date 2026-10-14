# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.npm \
  npm ci \
    --fetch-retries=5 \
    --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=10000 \
    --fetch-retry-maxtimeout=120000 \
    --fetch-timeout=300000

FROM dependencies AS builder

COPY . .
ARG NEXT_ASSET_PREFIX
ENV NEXT_ASSET_PREFIX=${NEXT_ASSET_PREFIX}
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ARG NEXT_ASSET_PREFIX
ENV NEXT_ASSET_PREFIX=${NEXT_ASSET_PREFIX}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
RUN npm prune --omit=dev --include=optional \
  && case "$(dpkg --print-architecture)" in \
    amd64) test -f node_modules/@next/swc-linux-x64-gnu/next-swc.linux-x64-gnu.node ;; \
    arm64) test -f node_modules/@next/swc-linux-arm64-gnu/next-swc.linux-arm64-gnu.node ;; \
    *) echo "Unsupported container architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
  esac \
  && npm cache clean --force
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
RUN mkdir -p /app/storage/uploads && chown -R node:node /app/storage

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
