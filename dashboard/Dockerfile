FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

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
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
RUN mkdir -p /app/storage/uploads && chown -R node:node /app/storage

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
