# MADLAB Infrastructure Guide

## 🏗️ Architecture Overview

MADLAB is now a **self-hosted, containerized full-stack application** designed for deployment on Enclii PaaS.

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
├─────────────────┬─────────────────┬─────────────────────┤
│   PostgreSQL    │   Backend API   │   Frontend Client   │
│   (postgres:16) │   (Fastify)     │   (React + Vite)    │
│   Port: 5432    │   Port: 3001    │   Port: 5173 (dev)  │
│                 │                 │   Port: 80 (prod)   │
└─────────────────┴─────────────────┴─────────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 18 + TypeScript + Vite | Interactive UI |
| **Backend** | Fastify + TypeScript | High-performance API |
| **Database** | PostgreSQL 16 | Persistent data storage |
| **ORM** | Drizzle ORM | Type-safe database operations |
| **Auth** | JWT (Janua IdP) | Authentication & authorization |
| **Container** | Docker + Docker Compose | Consistent deployment |

---

## 🚀 Quick Start

### Prerequisites

- **Docker** 24.0+ ([Install Docker](https://docs.docker.com/get-docker/))
- **Docker Compose** 2.20+ (included with Docker Desktop)
- **Node.js** 20+ (for local development)
- **Git** 2.40+

### Boot the Full Stack (30 seconds)

```bash
# 1. Clone the repository
git clone https://github.com/madfam-io/accionables-madlab.git
cd accionables-madlab

# 2. Start all services
docker compose up -d

# 3. Watch the logs
docker compose logs -f

# 4. Verify services are running
docker compose ps
```

**That's it!** The entire stack is now running:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health
- **Database**: localhost:5432 (postgres/madlab/madlab)

---

## 📁 Monorepo Structure

```
accionables-madlab/
├── apps/
│   ├── client/                  # React frontend
│   │   ├── src/
│   │   ├── public/
│   │   ├── Dockerfile           # Multi-stage: dev + prod (nginx)
│   │   ├── nginx.conf           # Production nginx config
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── server/                  # Fastify backend
│       ├── src/
│       │   ├── config/          # Database & environment
│       │   ├── db/
│       │   │   └── schema.ts    # Drizzle ORM schema
│       │   ├── middleware/
│       │   │   └── auth.ts      # JWT verification (mock + Janua)
│       │   ├── routes/
│       │   │   └── health.ts    # Health check endpoints
│       │   └── index.ts         # Fastify server entry
│       ├── drizzle/             # Database migrations (generated)
│       ├── Dockerfile           # Multi-stage: dev + prod
│       ├── drizzle.config.ts    # Drizzle Kit configuration
│       ├── package.json
│       └── tsconfig.json
│
├── docker-compose.yml           # Orchestration (postgres + server + client)
├── package.json                 # Root monorepo config
├── README_INFRA.md              # This file
└── docs/                        # Application documentation
```

---

## 🐳 Docker Services

### 1. PostgreSQL Database

```yaml
Image: postgres:16-alpine
Container: madlab-postgres
Port: 5432
Credentials:
  User: madlab
  Password: madlab
  Database: madlab
```

**Connect locally**:
```bash
psql postgresql://madlab:madlab@localhost:5432/madlab
```

### 2. Backend API (Fastify)

```yaml
Build: apps/server/Dockerfile
Container: madlab-server
Port: 3001
Environment:
  NODE_ENV: development
  DATABASE_URL: postgresql://madlab:madlab@postgres:5432/madlab
```

**Health check**:
```bash
curl http://localhost:3001/api/health
```

**Development mode**: Hot reload enabled via `tsx watch`

### 3. Frontend Client (React + Vite)

```yaml
Build: apps/client/Dockerfile
Container: madlab-client
Port: 5173 (dev), 80 (prod)
Environment:
  VITE_API_URL: http://localhost:3001
```

**Development mode**: Vite HMR (Hot Module Replacement)
**Production mode**: Nginx serving static build

---

## 🛠️ Development Workflow

### Start Development

```bash
# Start all services in detached mode
docker compose up -d

# Or start with live logs
docker compose up

# Start only specific services
docker compose up postgres server
docker compose up client
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f server
docker compose logs -f client
docker compose logs -f postgres
```

### Restart Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart server

# Rebuild and restart (after Dockerfile changes)
docker compose up -d --build server
```

### Stop Services

```bash
# Stop all
docker compose down

# Stop and remove volumes (CAUTION: deletes database!)
docker compose down -v
```

### Access Container Shell

```bash
# Server container
docker compose exec server sh

# Client container
docker compose exec client sh

# Database container
docker compose exec postgres psql -U madlab
```

---

## 🗄️ Database Management

### Schema & Migrations (Drizzle ORM)

```bash
# Enter server container
docker compose exec server sh

# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (development only)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio
```

### Direct Database Access

```bash
# Via Docker
docker compose exec postgres psql -U madlab

# Via local psql
psql postgresql://madlab:madlab@localhost:5432/madlab
```

### Backup & Restore

```bash
# Backup
docker compose exec postgres pg_dump -U madlab madlab > backup.sql

# Restore
docker compose exec -T postgres psql -U madlab madlab < backup.sql
```

---

## 🔐 Authentication System

### Development Mode (Mock JWT)

For local development, the backend accepts a hardcoded token:

```bash
# Example API call with mock token
curl -H "Authorization: Bearer dev-token-mock-user" \
     http://localhost:3001/api/health
```

**Mock user details**:
```typescript
{
  sub: 'mock-user-id-12345',
  email: 'aldo@madlab.io',
  name: 'Aldo (Dev Mode)'
}
```

### Production Mode (Janua IdP)

In production (`NODE_ENV=production`), the server will:

1. Extract JWT from `Authorization: Bearer <token>` header
2. Verify RS256 signature using Janua's public keys
3. Validate token claims (exp, iss, aud)
4. Attach user info to request

**Environment variables required**:
```env
JANUA_ISSUER=https://auth.enclii.com
JANUA_AUDIENCE=madlab-api
JANUA_JWKS_URI=https://auth.enclii.com/.well-known/jwks.json
```

**Implementation location**: `apps/server/src/middleware/auth.ts`

---

## 🌍 Environment Variables

### Backend (`apps/server/.env`)

```env
# Environment
NODE_ENV=development

# Server
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://madlab:madlab@postgres:5432/madlab

# CORS
ALLOWED_ORIGINS=https://madlab.app,https://app.madlab.io

# Janua IdP (Production)
JANUA_ISSUER=https://auth.enclii.com
JANUA_AUDIENCE=madlab-api
JANUA_JWKS_URI=https://auth.enclii.com/.well-known/jwks.json
```

**Template available**: `apps/server/.env.example`

### Frontend (`apps/client/.env`)

```env
VITE_API_URL=http://localhost:3001
VITE_APP_ENV=development
```

---

## 🚢 Production Deployment

### Build Production Images

```bash
# Build all production images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Build specific service
docker compose build --target production server
docker compose build --target production client
```

### Production Compose File (Example)

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    restart: always
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # Use secrets!

  server:
    build:
      target: production
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      JANUA_ISSUER: ${JANUA_ISSUER}
      JANUA_AUDIENCE: ${JANUA_AUDIENCE}
    restart: always

  client:
    build:
      target: production
    ports:
      - '80:80'
    restart: always
```

### Deploy to Enclii PaaS

There is no compose-based Enclii deploy: `enclii deploy` has no `--app` or
`--compose` flag, and images are not pushed by hand. Deploys go through GitHub
Actions, not a CLI call: a push to `main` that touches `apps/**` runs `.github/workflows/enclii-build.yml`, which builds the
`client` and `server` images, pushes them to GHCR, and commits their digests
to `infra/k8s/overlays/staging/kustomization.yaml` for ArgoCD to reconcile.
Production promotion is a separate workflow (`promote-to-prod.yml`) that
copies the staging digest into `infra/k8s/production/`.

---

## 🧪 Testing

### Run Tests in Containers

```bash
# Client tests
docker compose exec client npm test
docker compose exec client npm run test:e2e

# Server tests (when implemented)
docker compose exec server npm test
```

### Local Development Testing

```bash
# Client
cd apps/client
npm test
npm run test:e2e

# Server
cd apps/server
npm test
```

---

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check service status
docker compose ps

# View detailed logs
docker compose logs <service-name>

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up
```

### Database Connection Issues

```bash
# Check postgres is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Test connection
docker compose exec postgres pg_isready -U madlab

# Manually connect
docker compose exec postgres psql -U madlab
```

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or use different port in docker-compose.yml
ports:
  - '3002:3001'  # Host:Container
```

### Clear Everything (Nuclear Option)

```bash
# Stop all containers
docker compose down

# Remove all containers, networks, volumes
docker compose down -v --remove-orphans

# Remove all images
docker rmi $(docker images -q madlab*)

# Prune Docker system
docker system prune -af --volumes

# Restart fresh
docker compose up --build
```

---

## 📊 Monitoring & Health Checks

### Built-in Health Endpoints

```bash
# Backend health
curl http://localhost:3001/api/health

# Readiness probe (Kubernetes)
curl http://localhost:3001/api/health/ready

# Liveness probe (Kubernetes)
curl http://localhost:3001/api/health/live

# Frontend health (production)
curl http://localhost/health
```

### Container Health Status

```bash
# Check health of all containers
docker compose ps

# Watch health status
watch -n 2 'docker compose ps'
```

---

## 🔧 Advanced Configuration

### Custom Database Configuration

Edit `docker-compose.yml`:

```yaml
postgres:
  environment:
    POSTGRES_USER: custom_user
    POSTGRES_PASSWORD: custom_pass
    POSTGRES_DB: custom_db
  # Add custom postgres.conf
  volumes:
    - ./postgres.conf:/etc/postgresql/postgresql.conf
  command: postgres -c config_file=/etc/postgresql/postgresql.conf
```

### Scale Services (Multi-Instance)

```bash
# Run 3 backend instances (requires load balancer)
docker compose up --scale server=3
```

### Custom Networks

```yaml
networks:
  madlab-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16
```

---

## 📚 Additional Resources

- [Fastify Documentation](https://fastify.dev/)
- [Drizzle ORM Guide](https://orm.drizzle.team/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)

---

## 🆘 Support

- **GitHub Issues**: https://github.com/madfam-io/accionables-madlab/issues
- **Documentation**: `/docs` directory
- **Team**: Aldo, Nuri, Luis, Silvia, Caro

---

**Built with ❤️ for Educational Innovation**

*Last Updated: November 24, 2026*
*Version: 2.0.0 (Monorepo + Docker)*
