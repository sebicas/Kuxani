# ──────────────────────────────────────────────
# Stage 1: Install dependencies
# ──────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --legacy-peer-deps --no-update-notifier

# ──────────────────────────────────────────────
# Stage 2: Build the application
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for public env vars needed at build time
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_WS_URL
ARG COMMIT_SHA
ARG SOURCE_COMMIT

ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV COMMIT_SHA=${COMMIT_SHA:-${SOURCE_COMMIT}}

# Force production mode for Next.js build (Coolify may inject NODE_ENV=development
# as an ARG, but next build must always run in production mode)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Compile custom server.ts to server.js
RUN npx tsc --project tsconfig.server.json

# ──────────────────────────────────────────────
# Stage 3: Production runner
# ──────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# NODE_ENV must always be production for Next.js standalone mode.
# Use APP_ENV to label the deployment environment (development, staging, production).
ENV NODE_ENV=production
ARG APP_ENV=production
ENV APP_ENV=${APP_ENV}
ENV NEXT_TELEMETRY_DISABLED=1

# Git commit SHA for health endpoint
ARG COMMIT_SHA
ARG SOURCE_COMMIT
ENV COMMIT_SHA=${COMMIT_SHA:-${SOURCE_COMMIT}}

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone server + node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy custom server.js (replaces default standalone server.js)
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

# Copy compiled server dependencies (tsc output from tsconfig.server.json)
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/db ./src/lib/db
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/auth ./src/lib/auth
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/socket/socketServer.js ./src/lib/socket/socketServer.js

# Copy Drizzle config and migrations for runtime migrate
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle/migrations ./drizzle/migrations

# Copy drizzle-kit + postgres driver + all transitive deps from builder
COPY --from=builder /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

# Run migrations then start the custom server
CMD ["sh", "-c", "npx --no-update-notifier drizzle-kit migrate --config=drizzle.config.ts >/dev/null 2>&1 && node server.js"]
