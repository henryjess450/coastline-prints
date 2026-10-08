# Coastline Prints: production image.
#   docker compose up -d --build
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Install dependencies (also generates the Prisma client via postinstall).
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
ENV DATABASE_URL=file:/app/data/coastline.db
RUN npm ci

# 2. Build the site.
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Inlined into the browser bundle at build time.
ARG NEXT_PUBLIC_MAX_UPLOAD_MB=100
ENV NEXT_PUBLIC_MAX_UPLOAD_MB=$NEXT_PUBLIC_MAX_UPLOAD_MB \
    DATABASE_URL=file:/app/data/coastline.db
# Cap the build at 3 GB so a small Docker VM does not kill it (raise it if the build says "heap out of memory").
RUN npx prisma generate && NODE_OPTIONS=--max-old-space-size=3072 npx next build

# 3. Run it.
FROM base AS runner
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3100 \
    DATABASE_URL=file:/app/data/coastline.db \
    STORAGE_DIR=/app/storage
COPY --from=build /app ./
RUN mkdir -p /app/data /app/storage /app/backups \
 && chown -R node:node /app/data /app/storage /app/backups /app/.next
USER node
EXPOSE 3100
# Apply any new database migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node scripts/start.mjs"]
