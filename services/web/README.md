# MaxMarket Web (Frontend)

React + TypeScript + Vite SPA for the MaxMarket B2B wholesale platform. Phase 7 implementation.

## Stack

- **Framework:** React 18+ with TypeScript
- **Build:** Vite
- **UI:** shadcn/ui (Tailwind CSS)
- **Server state:** TanStack Query v5
- **Routing:** React Router v6+

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts the dev server. API requests to `/api/v1/*` are proxied to `http://localhost:3000` (backend). Set `VITE_API_BASE_URL` in `.env` if the backend runs elsewhere.

## Build

```bash
npm run build
```

Output in `dist/`.

## Seed users

| Email                     | Role        | Password   |
|---------------------------|-------------|------------|
| `super_admin@maxmarket.com` | super_admin | ChangeMe1! |
| `admin1@maxmarket.com`    | admin       | ChangeMe1! |
| `manager1@maxmarket.com`  | manager     | ChangeMe1! |
| `agent1@maxmarket.com`    | agent       | ChangeMe1! |
| `client1@maxmarket.com`   | client      | ChangeMe1! |

## Phase 7 scope

- Project scaffolding (Task 7.1)
- Typed API client with auth header, correlation ID, Accept-Language, token refresh on 401 TOKEN_EXPIRED (Task 7.2)
- Auth flow: login page, auth context (access token in memory only), protected routes, logout (Task 7.3)
- Layout: sidebar + top bar, role-aware nav from `rbac.json`, language selector, logout (Task 7.4)
- Catalog browse: product list (pagination, search, category filter), product detail; public (no prices) and authenticated (API returns role-appropriate prices) (Task 7.5)
- Error handling: global error boundary, toasts for API errors, loading/empty states (Task 7.6)

Orders, Inventory, Users, Client Groups, Reports, Audit, Settings are placeholder routes (“Coming soon”).
