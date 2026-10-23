# syntax=docker/dockerfile:1

# One patched runtime and system trust store for every stage. Update the tag
# and manifest digest together when taking a newer supported Node release.
FROM node:22.23.4-alpine3.24@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS base
RUN apk add --no-cache --upgrade \
    'ca-certificates>=20261020-r0' \
    'ca-certificates-bundle>=20261020-r0'

# ---------- deps ----------
FROM base AS deps
WORKDIR /app
# Build toolchain so better-sqlite3 can compile from source if its prebuilt
# binary is unavailable (e.g. offline/restricted networks).
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- build ----------
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/config ./config
COPY --chown=nextjs:nodejs scripts/verify-tls.mjs ./scripts/verify-tls.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/node-addon-api ./node_modules/node-addon-api

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
