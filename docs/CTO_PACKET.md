# CTO_PACKET.md

## Project: MaxMarket

### Version: 1.0 (Architecture Baseline Locked)

---

# 1. Executive Overview

MaxMarket is a closed B2B wholesale web platform designed for internal sales operations and client visibility.

The system enables:

- Agents to create orders for assigned clients
- Managers to approve or reject orders
- Admin to version-edit approved orders
- Warehouse fulfillment processing
- Multi-language support
- Future-ready multi-warehouse architecture
- Future-ready accounting two-way sync

Clients cannot create orders themselves.

---

# 2. Business Model

## Type

Closed B2B wholesale management platform.

## Access

- Public catalog view (no pricing visible)
- Registered clients only see prices
- Orders created only by Agents

## Seller

Single wholesaler (v1)

---

# 3. Roles & RBAC

## Super Admin

- Full system access
- System configuration
- Language management
- Audit clearing (soft delete only)
- Role & permission control

## Admin

- Full business control
- Edit approved orders (creates new version)
- Modify pricing rules
- Modify stock (with audit)
- View all data

## Manager

- Approve/reject submitted orders
- Override price before approval
- Mark orders as Fulfilled
- View all clients
- View stock
- View cost price

## Agent

- Create/edit/delete Draft orders
- Submit orders
- View only assigned clients
- View stock
- View cost price
- Cannot approve

## Client

- View catalog (with own pricing)
- View order history
- Track order statuses
- Cannot modify orders
- Cannot see other clients
- Cannot see cost price

---

# 4. Order State Machine

States:

Draft  
→ Submitted  
→ Approved  
→ Fulfilled  
→ Returned

Draft  
→ Submitted  
→ Rejected

Approved  
→ Cancelled

Approved (Admin Edit)  
→ New Version  
→ Requires Re-Approval

Rules:

- Only Agents create orders.
- Only Managers approve.
- No partial approvals.
- Approval blocks if insufficient stock.
- Admin edits create new version.
- New version requires approval.
- Stock recheck mandatory for version edit.

---

# 5. Inventory & Stock Engine

Future-proof multi-warehouse design (v1 uses one warehouse).

Table model:

warehouse_stock

- warehouse_id
- product_variant_id
- available_qty
- reserved_qty

## Reservation Logic

At Approval:

- reserved_qty += order_qty

At Fulfillment:

- reserved_qty -= order_qty
- available_qty -= order_qty

At Cancellation:

- reserved_qty -= order_qty

Constraints:

- Cannot approve if available_qty < order_qty
- Cannot adjust stock below reserved_qty
- All stock changes audited

Stock is operational authority in v1.
Accounting sync in v2.

---

# 6. Product Model

Products support variants.

Variant characteristics:

- Separate SKU
- Own stock
- Own price
- Own images
- Units: piece, box, kg
- Minimum order quantity
- Price per unit and per box

Multilingual fields stored as JSON:

- name
- description
- category name

---

# 7. Pricing Engine

## Base Rule

Client visible price:
base_price - group_discount

Group discount assigned per client group.

## Manager Override

- Manager can override price before approval.
- Override replaces final price.
- Override logged.
- Only final price visible in UI.

No stacking logic.
Deterministic pricing only.

---

# 8. Order Versioning

Admin editing:

- Creates new order version.
- Original version immutable.
- Requires re-approval.
- Triggers stock recheck.
- Full audit diff stored.

---

# 9. Reporting

Required reports:

- Sales by date
- Sales by manager
- Sales by client
- Sales by product
- CSV export
- PDF export
- Filtered export

No profit margin reporting in v1.

---

# 10. Translation System

- JSON-based multilingual fields for products
- UI translation module configurable by Super Admin
- Default system language: English
- Languages supported: English, Armenian, Russian
- Users can switch language

---

# 11. Audit System

Separate audit storage (append-only).

Log all:

- Order creation/edit
- Price overrides
- Stock adjustments
- Login attempts
- Permission changes
- Log clearing events

Soft delete only.
Log clearing is logged.

---

# 12. Search & Performance

- Indexed search on SKU
- Indexed search on product name
- Category filtering
- Pagination mandatory
- 100k products supported
- 20 concurrent users baseline
- Indexed queries required from start

---

# 13. Non-Functional Requirements

Security Level: Medium

Requirements:

- JWT auth with refresh
- RBAC server-side enforcement
- correlation_id for every request
- Rate limiting enabled
- Structured logs
- Zod validation server-side

---

# 14. Future Architecture (v2 Prepared)

Future additions:

- Multi-warehouse
- Two-way accounting sync (1C or Armenian accounting software)
- Delivery tracking (internal)
- Mobile apps for Client, Agent, Manager

Architecture must allow:

- External stock authority flags
- Sync status tracking
- Delivery entity linked to Order
- Event hooks for integrations

Not implemented in v1.

---

# 15. Deployment

v1:

- Web responsive
- Dockerized Postgres
- Single backend service
- Modular monolith architecture

---

# 16. Scale Expectation

- 100,000 products
- 300–1000 clients
- 50–100 orders/day
- 20 concurrent users

No horizontal scaling required initially.
