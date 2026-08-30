FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates cups-client sane-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js seaoil-agent.js ./

RUN mkdir -p /data /opt/scans /tmp/printdash-uploads \
    && chown -R node:node /data /opt/scans /tmp/printdash-uploads
COPY --chown=node:node printers.example.json /data/printers.json
COPY --chown=node:node settings.example.json /data/settings.json

ENV NODE_ENV=production \
    PORT=3003 \
    USERS_FILE=/data/users.json \
    DATA_FILE=/data/printers.json \
    SETTINGS_FILE=/data/settings.json \
    SCAN_DIR=/opt/scans \
    UPLOAD_DIR=/tmp/printdash-uploads

USER node

EXPOSE 3003

CMD ["npm", "start"]
