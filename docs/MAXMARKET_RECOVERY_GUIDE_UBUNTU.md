# MaxMarket — New Machine Recovery Guide (Ubuntu)

**Version:** 1.2.0  
**Last Updated:** 2026-02-28  
**Author:** CTO  
**Target OS:** Ubuntu 22.04 / 24.04

---

## Overview

This guide walks you through setting up the MaxMarket project on a fresh Ubuntu machine. It covers everything: development tools, source code, database, AI agent configurations, and the Claude project knowledge base.

**Estimated time:** 30–45 minutes

---

## Step 1: Update System & Install Essentials

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget build-essential git
```

---

## Step 2: Install Node.js (v20 LTS)

```bash
# Install via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version    # Should show v20.x
npm --version     # Should show 10.x
```

---

## Step 3: Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << 'EOF'
CREATE USER maxmarket_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE maxmarket_db OWNER maxmarket_user;
GRANT ALL PRIVILEGES ON DATABASE maxmarket_db TO maxmarket_user;
EOF

# Verify connection
psql -U maxmarket_user -d maxmarket_db -h localhost -c "SELECT 1;"
```

If the connection fails with "peer authentication", edit pg_hba.conf:

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Change the line for "local all all" from "peer" to "md5"
# Also ensure there's a line: host all all 127.0.0.1/32 md5
sudo systemctl restart postgresql
```

---

## Step 4: Set Up SSH Key for GitHub

```bash
# Generate key
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter for all defaults

# Start agent and add key
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copy public key to clipboard
cat ~/.ssh/id_ed25519.pub
# Select and copy the output manually
```

Add the key to GitHub:

1. Go to https://github.com/settings/keys
2. Click "New SSH key"
3. Paste the key, give it a title, click "Add SSH key"

Test:

```bash
ssh -T git@github.com
# Should say: "Hi YourUsername! You've successfully authenticated..."
```

---

## Step 5: Configure Git

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

---

## Step 6: Clone the Repository

```bash
# Create project directory
mkdir -p ~/projects
cd ~/projects

# Clone
git clone git@github.com:YOUR_USERNAME/maxmarket.git
cd maxmarket

# Verify tags
git tag -l
# Should show: v1.0.0, v1.1.0, v1.2.0
```

---

## Step 7: Install Dependencies

```bash
# Backend
cd services/api
npm install

# Frontend
cd ../web
npm install

# Return to root
cd ../..
```

---

## Step 8: Configure Environment Variables

```bash
cd services/api
cp .env.example .env
nano .env
```

Set these values:

```env
DATABASE_URL="postgresql://maxmarket_user:your_secure_password@localhost:5432/maxmarket_db"
JWT_SECRET="$(openssl rand -hex 32)"
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
CORS_ORIGIN=http://localhost:5173
LOG_LEVEL=info
```

Generate and paste a random JWT secret:

```bash
openssl rand -hex 32
# Copy the output and paste as JWT_SECRET value
```

---

## Step 9: Run Migrations and Seed

```bash
cd services/api

# Generate Prisma client
npx prisma generate

# Run all migrations
npx prisma migrate deploy

# Seed the database
npx prisma db seed
```

---

## Step 10: Start and Verify

### Start the Backend

```bash
# Terminal 1
cd ~/projects/maxmarket/services/api
npm run dev
```

Verify: http://localhost:3000/health should return OK.

### Start the Frontend

```bash
# Terminal 2
cd ~/projects/maxmarket/services/web
npm run dev
```

Verify: http://localhost:5173 should show the login page.

### Test Login

Seed accounts (all passwords: `ChangeMe1!`):

| Email | Role |
|-------|------|
| super_admin@maxmarket.com | Super Admin |
| admin1@maxmarket.com | Admin |
| manager1@maxmarket.com | Manager |
| agent1@maxmarket.com | Agent |
| client1@maxmarket.com | Client |

### Verification Checklist

- [ ] Login page loads (purple Materialize theme, split layout)
- [ ] Login with admin1@maxmarket.com works
- [ ] Redirects to /catalog after login
- [ ] Catalog shows products with images
- [ ] Sidebar has section labels (MAIN, MANAGEMENT, etc.)
- [ ] Grid toggle (3/4/5 columns) works
- [ ] Orders page loads
- [ ] Reports show stat cards and charts
- [ ] Language switch (EN/HY/RU) works
- [ ] Mobile responsive (resize to 375px)

---

## Step 11: Install Cursor IDE

```bash
# Download Cursor AppImage
wget -O ~/cursor.AppImage https://downloader.cursor.sh/linux/appImage/x64
chmod +x ~/cursor.AppImage

# Run
~/cursor.AppImage
```

Or install via .deb if available from https://cursor.sh/

Log in with your existing Cursor account — your settings carry over.

### Open Projects

- Backend work: Open `~/projects/maxmarket/services/api`
- Frontend work: Open `~/projects/maxmarket/services/web`

### Agent Configs

Agent role definitions are in the repo at `docs/agents/`:

| File | Role |
|------|------|
| CURSOR_BACKEND.txt | Backend Engineer AI |
| CURSOR_WEB.txt | Frontend Engineer AI |
| CURSOR_MOBILE.txt | Mobile Engineer AI |
| CLAUDE_ARCHITECT.txt | Solution Architect AI |
| CLAUDE_PO.txt | Product Owner AI |
| CLAUDE_QA.txt | QA Lead AI |
| CLAUDE_SECURITY.txt | Security Reviewer AI |

---

## Step 12: Set Up Claude.ai Project (New Account)

Since you have a new Claude account, you need to create a fresh project and upload all knowledge documents.

### Create the Project

1. Go to https://claude.ai
2. Log in to your new account
3. Go to Projects → Create New Project
4. Name: **"MaxMarket"**

### Upload Project Knowledge

All documents are in the cloned repo under `docs/`. Upload them as Project Knowledge.

```bash
# List all files to upload
find ~/projects/maxmarket/docs -type f | sort
```

**Upload in this order:**

**1. Core Product Documents** (from `docs/product/`):

```
01_PRODUCT_VISION.md
02_PRD.md
03_USER_STORIES.md
04_ACCEPTANCE_CRITERIA.md
06_ARCHITECTURE.md
07_API_SPEC.md
08_DB_SCHEMA.md
09_RBAC_SECURITY.md
14_GLOSSARY.md
SEED_DATA.md
```

**2. AI Factory Framework** (from `docs/`):

```
ENGINEERING_CONSTITUTION.md
ORCHESTRATION_PROTOCOL.md
PROJECT_LIFECYCLE.md
CTO_PACKET.md
DECISION_LOG.md
DEPLOYMENT.md
CHANGELOG.md
```

**3. Agent Configs** (from `docs/agents/`):

```
CLAUDE_ARCHITECT.txt
CLAUDE_PO.txt
CLAUDE_QA.txt
CLAUDE_SECURITY.txt
CURSOR_BACKEND.txt
CURSOR_WEB.txt
CURSOR_MOBILE.txt
```

**4. Gate Reports** (from `docs/gates/`):

```
CTO_GATE_REPORT_PHASE3.md
CTO_GATE_REPORT_PHASE4.md
CTO_GATE_REPORT_PHASE5.md
CTO_GATE_REPORT_PHASE6.md
PHASE4_SUMMARY.md
PHASE5_SUMMARY.md
```

**5. QA Results** (from `docs/qa/`):

```
QA_TEST_PLAN_PHASE8.md
QA_RESULTS_PHASE8.md
QA_RESULTS_PHASE10.md
QA_RESULTS_PHASE11.md
QA_RESULTS_PHASE12.md
```

**6. Remaining Documents** (from `docs/`):

```
CONSISTENCY_REPORT.md
CTO_DECISION_ADDENDUM_v1.md
CTO_PACKET_TEMPLATE.md
DB_PERF_NOTES.md
OPENAPI_DRIFT_CHECKLIST.md
```

### Verify Claude Has Context

Send this message in the new Claude project:

> "What is MaxMarket? Summarize the current project status, tech stack, and version."

Claude should accurately describe the B2B wholesale platform, Node.js/TypeScript + React/Vite stack, Materialize design, v1.2.0, etc.

---

## Step 13: Resume the AI Factory Workflow

The workflow is identical to before:

```
You (CTO)  ──→  Claude Project  ──→  Cursor Prompt Files
    ↑                                        │
    │                                        ↓
    └──── Paste reports back ←──── Cursor Agent executes
```

1. Talk to Claude for planning, decisions, prompt generation
2. Claude produces `CURSOR_PROMPT_*.md` files
3. Paste prompts into Cursor for the right agent
4. Cursor agent implements and reports back
5. Paste the report to Claude for review

---

## Optional: Docker Setup (Alternative to Local PostgreSQL)

If you prefer Docker over local PostgreSQL:

```bash
# Install Docker
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect

# Start database
cd ~/projects/maxmarket
docker-compose up -d postgres

# Update .env DATABASE_URL to match docker-compose settings
```

---

## Optional: Auto-Start Services

Create a simple script to start everything:

```bash
cat > ~/projects/maxmarket/start.sh << 'EOF'
#!/bin/bash
echo "Starting MaxMarket..."

# Start backend in background
cd ~/projects/maxmarket/services/api
npm run dev &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
sleep 3

# Start frontend in background
cd ~/projects/maxmarket/services/web
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "MaxMarket is running:"
echo "  API:      http://localhost:3000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait and cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
EOF

chmod +x ~/projects/maxmarket/start.sh
```

Run with: `~/projects/maxmarket/start.sh`

---

## Troubleshooting

### npm install fails with permission errors

```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

### PostgreSQL "peer authentication failed"

```bash
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Change: local all all peer
# To:     local all all md5
sudo systemctl restart postgresql
```

### Port already in use

```bash
# Find process on port 3000
sudo lsof -i :3000
kill -9 <PID>

# Find process on port 5173
sudo lsof -i :5173
kill -9 <PID>
```

### Prisma migrate fails

```bash
# Ensure database exists and is accessible
psql -U maxmarket_user -d maxmarket_db -h localhost -c "SELECT 1;"

# Reset if needed (WARNING: destroys all data)
npx prisma migrate reset
```

### SSH key not working after reboot

```bash
# Add to ~/.bashrc to auto-start agent
echo 'eval "$(ssh-agent -s)" > /dev/null 2>&1' >> ~/.bashrc
echo 'ssh-add ~/.ssh/id_ed25519 > /dev/null 2>&1' >> ~/.bashrc
source ~/.bashrc
```

### Cursor AppImage won't run

```bash
# Install FUSE (required for AppImage)
sudo apt install -y libfuse2
chmod +x ~/cursor.AppImage
~/cursor.AppImage
```

---

## Quick Reference

| Resource | Location |
|----------|----------|
| Source code | `~/projects/maxmarket/` |
| Backend | `services/api/` |
| Frontend | `services/web/` |
| Agent configs | `docs/agents/` |
| Product docs | `docs/product/` |
| Environment config | `services/api/.env` |
| Migrations | `services/api/prisma/migrations/` |
| Seed data | `services/api/prisma/seed.ts` |
| API health | http://localhost:3000/health |
| Frontend | http://localhost:5173 |
| Start script | `~/projects/maxmarket/start.sh` |

---

**END OF GUIDE**
