# MaxMarket — Developer Setup Guide

This guide gets you from a fresh clone to a running application (Docker or local dev).

---

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **Docker** and **Docker Compose**
- **Git**

Optional for local dev: npm 10+.

---

## Quick Start (Docker)

Run the full stack with zero configuration:

```bash
# From project root
docker-compose up --build
```

- **Frontend:** http://localhost:5173  
- **API:** http://localhost:3000  

The API runs migrations and seed on startup. No `.env` file is required; defaults work out of the box.

---

## Quick Start (Local dev with hot reload)

1. **Start the database only:**
   ```bash
   docker-compose up postgres -d
   ```

2. **Backend:**
   ```bash
   cd services/api
   npm install
   npx prisma migrate deploy
   npx prisma db seed
   npm run dev
   ```
   Backend runs at http://localhost:3000.

3. **Frontend** (new terminal):
   ```bash
   cd services/web
   npm install
   npm run dev
   ```
   Frontend runs at http://localhost:5173 (Vite proxies `/api/v1` to the backend).

---

## Seed users

After running migrations and seed, you can log in with these accounts. **Password for all:** `ChangeMe1!`

| Email | Role |
|-------|------|
| super_admin@maxmarket.com | super_admin |
| admin1@maxmarket.com | admin |
| manager1@maxmarket.com | manager |
| agent1@maxmarket.com | agent |
| agent2@maxmarket.com | agent |
| client1@maxmarket.com | client |
| client2@maxmarket.com | client |
| client3@maxmarket.com | client |

See `docs/SEED_DATA.md` for full seed reference.

---

## Running tests

**Backend tests:**

```bash
cd services/api
npm run test
```

Or from project root:

```bash
npm run test:api
```

Tests expect a seeded database (e.g. after `npx prisma db seed`). Use the same `DATABASE_URL` as your dev environment.

---

## Useful commands

| Action | Command |
|--------|--------|
| Start stack (Docker) | `npm run dev` or `docker-compose up` |
| Build and start | `npm run dev:build` or `docker-compose up --build` |
| Stop stack | `npm run dev:down` or `docker-compose down` |
| Reset (remove volumes, rebuild) | `npm run dev:reset` |
| Run API tests | `npm run test:api` |
| Build API only | `npm run build:api` |
| Build web only | `npm run build:web` |
| Seed database | `npm run seed` |

**Per-service:**

| Service | Location | Dev command | Build |
|---------|----------|-------------|-------|
| API | `services/api` | `npm run dev` | `npm run build` |
| Web | `services/web` | `npm run dev` | `npm run build` |

---

## Troubleshooting

### Port already in use

- **Windows (PowerShell):** Find process on port (e.g. 3000):  
  `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object OwningProcess`  
  Then stop the process or change the port in your config.
- **Linux/macOS:** `lsof -i :3000` (or `:5173`, `:5432`) to see the process; kill with `kill <PID>`.

### Database connection refused

- Ensure Docker is running and the Postgres container is up: `docker-compose ps`.
- For local dev, start Postgres first: `docker-compose up postgres -d`.
- Check `DATABASE_URL` matches your setup (localhost for local dev, `postgres` hostname inside Docker).

### Prisma migration errors

- **Reset database (destroys data):**  
  `cd services/api && npx prisma migrate reset`  
  This applies migrations from scratch and runs seed. Use only in dev.

### Docker build fails for API or web

- From project root, run `docker-compose build --no-cache <service>` (e.g. `api` or `web`) to force a clean build.
- Ensure `services/api` and `services/web` have valid `package.json` and lockfiles.

---

## Environment variables

Copy `.env.example` to `.env` and adjust if needed. Docker Compose uses the same variable names with defaults, so `docker-compose up` works without a `.env` file. For production, set strong `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `NODE_ENV=production`.
