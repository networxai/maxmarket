# 01_PRODUCT_VISION.md
## MaxMarket — Product Vision
**Version:** 1.0  
**Status:** Baseline Locked

---

## 1. Vision Statement

MaxMarket is a closed B2B wholesale management platform that digitizes and streamlines the internal sales workflow of a single wholesaler. It gives sales agents a structured environment to create orders on behalf of clients, gives managers control over approval and fulfillment, and gives clients transparent visibility into their catalog pricing and order history — without exposing them to any operational controls.

The platform is designed to grow: its architecture anticipates multi-warehouse operations, accounting integrations, delivery tracking, and mobile access — none of which are in scope for v1 but must not be blocked by v1 design decisions.

---

## 2. Problem Being Solved

| Problem | Who Feels It |
|---|---|
| Orders are created informally with no approval trail | Managers, Admin |
| Clients call to check order status | Agents, Clients |
| Stock over-commitment happens at fulfillment | Warehouse, Admin |
| Pricing inconsistencies between clients go untracked | Admin, Manager |
| No version history when approved orders are edited | Admin, Auditors |
| No unified audit record of who changed what | Admin, Super Admin |

---

## 3. Target Users

| Role | Who They Are |
|---|---|
| Super Admin | IT/owner-level operator who configures the system |
| Admin | Business controller who manages pricing, stock, and approved orders |
| Manager | Sales manager who approves orders and marks fulfillment |
| Agent | Salesperson who creates and submits orders for their assigned clients |
| Client | Wholesale buyer who views catalog and tracks their own orders |

---

## 4. Core Value Propositions

**For Agents:** A clean, guided order creation flow with real-time stock visibility and client-specific pricing.

**For Managers:** A controlled approval queue with the ability to override pricing before committing.

**For Admin:** Full business control — editable approved orders with version history, stock management with audit, and pricing rule management.

**For Clients:** Self-service visibility into their catalog (with personalized pricing) and their full order history and statuses — without needing to call.

**For Super Admin:** Full system configurability including language management, roles, and audit governance.

---

## 5. Business Model Context

- **Type:** Closed B2B wholesale platform
- **Seller:** Single wholesaler (v1)
- **Access model:** Public catalog (no prices visible to anonymous users); registered clients see their own prices; only Agents create orders
- **No client self-ordering** in v1 or any planned version per current scope

---

## 6. MVP Scope (v1)

The following capabilities constitute the complete v1 release:

- Role-based access for all five roles
- Full order lifecycle: Draft → Submitted → Approved → Fulfilled / Rejected / Cancelled / Returned
- Order versioning when Admin edits approved orders
- Inventory reservation engine (single warehouse)
- Client-group pricing with Manager override
- Multilingual product catalog (English, Armenian, Russian)
- Reporting: sales by date, manager, client, product — CSV and PDF export
- Audit log (append-only, soft delete)
- Client-facing catalog and order history view
- JWT authentication with refresh tokens
- Responsive web application

---

## 7. Out of Scope for v1 (Future / v2)

The following are explicitly **not implemented** in v1 but the architecture must not prevent them:

| Feature | Notes |
|---|---|
| Multi-warehouse support | Data model prepared; single warehouse in v1 |
| Two-way accounting sync (1C / Armenian software) | Event hooks must be possible |
| Delivery tracking | Delivery entity to be linked to Order in v2 |
| Mobile apps (Client, Agent, Manager) | Responsive web only in v1 |
| Profit margin reporting | Not in v1 |
| External stock authority | Flag prepared; not active in v1 |

---

## 8. Success Criteria for v1

- Agents can create and submit orders without managerial intervention in the creation step
- No order can be approved when stock is insufficient
- Every stock change is audited
- Every price override is logged
- Clients can view their orders and catalog without contacting an Agent
- Admin can edit an approved order without destroying its history
- System supports 100,000 products and 20 concurrent users with paginated, indexed queries
