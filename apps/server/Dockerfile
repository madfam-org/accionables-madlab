# syntax=docker/dockerfile:1.7
#
# Build context: repo root. See .github/workflows/enclii-build.yml.
# Monorepo: npm workspaces at apps/* — root package.json owns the lockfile.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat tini dumb-init
COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
RUN npm ci --workspaces --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY . .
RUN npm run build --workspace=apps/server

FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
RUN npm ci --workspaces --include-workspace-root --omit=dev && npm cache clean --force

COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle

RUN chown -R nodejs:nodejs /app
USER nodejs

WORKDIR /app/apps/server
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/index.js"]
