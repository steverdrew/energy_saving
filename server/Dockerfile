# Explicit Dockerfile instead of relying on Cloud Run's auto-detected
# Buildpacks -- better-sqlite3 is a native module that needs a real
# compiler toolchain, and buildpacks' build failures gave no usable error
# output when this was deployed via `gcloud run deploy --source`. (Ruled
# out as the root cause of the opaque build failure -- see HANDOFF.md.)
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && npm ci --omit=dev \
    && apt-get purge -y python3 make g++ \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY src ./src

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "src/index.js"]
