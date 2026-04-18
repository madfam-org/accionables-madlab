# syntax=docker/dockerfile:1.7
#
# Build context: repo root. See .github/workflows/enclii-build.yml.
# Monorepo: npm workspaces at apps/* — root package.json owns the lockfile.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
RUN npm ci --workspaces --include-workspace-root

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/client/node_modules ./apps/client/node_modules
COPY . .
RUN npm run build --workspace=apps/client

FROM nginx:alpine AS production
COPY apps/client/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/apps/client/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
