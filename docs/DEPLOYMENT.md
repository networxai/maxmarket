# MaxMarket — Production Deployment Guide

## Prerequisites

- Docker and Docker Compose (v2+)
- A server with at least 2GB RAM
- A domain name (optional but recommended)
- SSL certificate (Let's Encrypt / Cloudflare)

## 1. Clone and Configure

```bash
git clone <repo-url>
cd MaxMarket
cp .env.example .env
```

Edit `.env` — change ALL variables marked [PRODUCTION]:

- `POSTGRES_PASSWORD`: Strong random password
- `JWT_ACCESS_SECRET`: `openssl rand -hex 64`
- `JWT_REFRESH_SECRET`: `openssl rand -hex 64` (different from above)
- `NODE_ENV`: `production`
- `CORS_ORIGIN`: `https://your-domain.com`

## 2. Build and Start

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

Verify:

- `curl http://localhost/health` → `{"status":"ok"}`
- Open http://localhost in browser → MaxMarket login page

## 3. HTTPS / SSL

Option A — Cloudflare Tunnel (simplest):

- Set up Cloudflare tunnel pointing to localhost:80

Option B — Reverse proxy with Caddy:

```
your-domain.com {
    reverse_proxy localhost:80
}
```

Caddy auto-provisions Let's Encrypt certificates.

Option C — nginx + certbot on the host (manual):

See certbot docs for your OS.

## 4. Initial Setup

Login with default admin:

- Email: `super_admin@maxmarket.com`
- Password: `ChangeMe1!`
- **Change this password immediately** via the user management page.

## 5. Backup

```bash
# Manual backup
docker exec maxmarket_postgres pg_dump -U maxmarket_user maxmarket_db > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20260227.sql | docker exec -i maxmarket_postgres psql -U maxmarket_user maxmarket_db
```

Or use the backup script:

```bash
./scripts/backup.sh
```

## 6. Monitoring

- Health check: `GET /health`
- API logs: `docker logs maxmarket_api --tail 100 -f`
- Web logs: `docker logs maxmarket_web --tail 100 -f`
- DB logs: `docker logs maxmarket_postgres --tail 100 -f`

## 7. Updates

```bash
git pull
docker-compose -f docker-compose.prod.yml up -d --build
```

## 8. Rollback

```bash
# If something breaks after update:
docker-compose -f docker-compose.prod.yml down
git checkout <previous-commit>
docker-compose -f docker-compose.prod.yml up -d --build
```

## Seed Users

| Email | Role | Password |
|-------|------|----------|
| super_admin@maxmarket.com | Super Admin | ChangeMe1! |
| admin1@maxmarket.com | Admin | ChangeMe1! |
| manager1@maxmarket.com | Manager | ChangeMe1! |
| agent1@maxmarket.com | Agent | ChangeMe1! |
| agent2@maxmarket.com | Agent | ChangeMe1! |
| client1@maxmarket.com | Client | ChangeMe1! |
| client2@maxmarket.com | Client | ChangeMe1! |
| client3@maxmarket.com | Client | ChangeMe1! |

**Change all passwords after first login.**
