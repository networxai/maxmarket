# 02_PRD.md
## MaxMarket — Product Requirements Document
**Version:** 1.0  
**Status:** Baseline Locked

---

## 1. Roles & Permissions (Behavioral Definition)

### 1.1 Super Admin

- Can access all areas of the system without restriction
- Can create, edit, deactivate any user account and assign/change roles
- Can manage system-level configuration (default language, supported languages, UI translation strings)
- Can clear audit logs (soft delete only; clearing event itself is logged)
- Cannot be locked out by any other role

### 1.2 Admin

- Can view all clients, all orders, all products, all pricing rules, all stock levels
- Can view cost price
- Can edit an Approved order — doing so creates a new immutable version and triggers re-approval workflow
- Can modify pricing rules (base price, group discount assignments)
- Can adjust stock quantities (all adjustments are audited; cannot reduce stock below reserved_qty)
- Cannot approve or reject orders
- Cannot permanently delete any record

### 1.3 Manager

- Can view all clients and all orders
- Can view stock levels and cost price
- Can approve or reject any Submitted order
- Can override the final price of any line item before approving (override is logged; only final price visible in UI)
- Can mark Approved orders as Fulfilled
- Cannot create or edit orders
- Cannot modify pricing rules or stock directly

### 1.4 Agent

- Can create, edit, and delete Draft orders only
- Can submit a Draft order (transitions it to Submitted)
- Can view only clients assigned to them
- Can view stock levels and cost price
- Cannot see other agents' clients or orders
- Cannot approve, reject, or fulfill orders
- Cannot modify pricing rules or stock

### 1.5 Client

- Can view the product catalog with their own group-discounted pricing (no cost price visible)
- Cannot see pricing visible to other client groups
- Can view their own order history and current order statuses
- Cannot create, modify, or cancel orders
- Cannot view other clients' data
- Cannot see internal operational data (stock levels, cost price, agent assignments)

---

## 2. Product & Catalog

### 2.1 Product Model

- Products have one or more variants
- Each variant has: its own SKU, stock record, price, images, unit type (piece / box / kg), minimum order quantity, price per unit, price per box
- Product names, descriptions, and category names are stored in multilingual JSON supporting English, Armenian, and Russian
- A product without variants cannot exist (a single-option product is a product with one variant)

### 2.2 Catalog Visibility

- Anonymous (public) users can browse the catalog but see no pricing
- Registered Clients see the catalog with their group-discounted pricing applied
- Agents and Managers see catalog with cost price and client pricing available
- Search is available on SKU and product name (indexed)
- Category filtering is available
- All catalog pages are paginated (mandatory)

---

## 3. Pricing Engine

### 3.1 Price Calculation

- Client visible price = `base_price - group_discount`
- Group discount is assigned at the client group level
- There is no stacking of discounts; pricing is deterministic
- Each client belongs to one group; each group has one discount rule per product variant

### 3.2 Manager Price Override

- Before approving an order, a Manager may override the price of any line item
- The override replaces the final price for that line item on that order
- The override is recorded in the audit log with: manager ID, original price, override price, timestamp, order ID
- Only the final price is visible in the UI to all roles (override amount is in audit only)

### 3.3 Decision Needed

- **DN-PRICE-01:** Does a Manager price override apply to the entire order or per line item?  
  *(CTO Packet states override replaces "final price" without specifying scope. Assumed per line item pending confirmation.)*
- **DN-PRICE-02:** Can Admin modify a client group's discount retroactively, and if so, does it affect existing Draft orders?

---

## 4. Order Lifecycle

### 4.1 States

| State | Description |
|---|---|
| Draft | Created by Agent; editable; not yet submitted for approval |
| Submitted | Agent has submitted; awaiting Manager review; no longer editable by Agent |
| Approved | Manager has approved; stock reserved; awaiting fulfillment |
| Fulfilled | Manager has marked as fulfilled; stock decremented |
| Rejected | Manager has rejected; order closed; Agent notified |
| Cancelled | Approved order cancelled; reserved stock released |
| Returned | Fulfilled order marked as returned |

### 4.2 Valid Transitions

```
Draft         → Submitted       (Agent action: Submit)
Submitted     → Approved        (Manager action: Approve)
Submitted     → Rejected        (Manager action: Reject)
Approved      → Fulfilled       (Manager action: Mark Fulfilled)
Approved      → Cancelled       (Admin or Manager action: Cancel)
Fulfilled     → Returned        (Manager or Admin action: Mark Returned)
Approved      → [New Version]   (Admin action: Edit — creates new version, triggers re-approval)
```

### 4.3 Rules

- Only Agents may create orders
- Only Managers may approve or reject orders
- Approval is all-or-nothing (no partial approval of line items)
- Approval is blocked if any line item has `available_qty < order_qty`
- Admin editing an Approved order creates a new version; the original version is immutable
- The new version enters a re-approval workflow (status resets to Submitted on new version)
- Every new version triggers a stock recheck
- A Rejected order cannot be re-submitted; Agent must create a new Draft
- A Cancelled order cannot be re-activated

### 4.4 Edge Cases

- **EC-ORD-01:** Agent submits an order and stock drops below required qty before Manager approves → Approval must be blocked at approval time, not at submission time
- **EC-ORD-02:** Admin edits an Approved order that already has a reserved stock qty → Stock reservation logic must account for delta between old version and new version
- **EC-ORD-03:** Agent attempts to edit a Submitted order → System must reject the action; order is locked from Agent edit once Submitted
- **EC-ORD-04:** Manager approves order; warehouse fails to fulfill; Manager marks as Returned → Stock reservation must be fully released on Return
- **EC-ORD-05:** Two Managers attempt to approve the same order simultaneously → System must enforce single-approval via optimistic locking or equivalent

### 4.5 Failure Scenarios

- **FS-ORD-01:** Approval attempted with insufficient stock → System returns a clear error listing which line items have insufficient stock; order remains in Submitted state
- **FS-ORD-02:** Order version creation fails mid-write → Original Approved order must remain intact; no partial version must be persisted
- **FS-ORD-03:** Stock adjustment fails audit write → Stock adjustment must be rolled back entirely (audit write and stock write are atomic)

---

## 5. Inventory & Stock Engine

### 5.1 Data Structure

- Stock is tracked at the warehouse-variant level: `(warehouse_id, product_variant_id)`
- Each record has `available_qty` and `reserved_qty`
- v1 operates with a single warehouse; the data model supports multiple warehouses

### 5.2 Reservation Logic

| Event | Effect on Stock |
|---|---|
| Order Approved | `reserved_qty += order_qty` |
| Order Fulfilled | `reserved_qty -= order_qty` AND `available_qty -= order_qty` |
| Order Cancelled | `reserved_qty -= order_qty` |
| Order Returned | `available_qty += order_qty` (Decision Needed — see DN-STK-01) |
| Stock Adjustment | `available_qty` changed by Admin; cannot go below `reserved_qty` |

### 5.3 Constraints

- Approval blocked if `available_qty < order_qty` for any line item
- Stock adjustment blocked if resulting `available_qty < reserved_qty`
- All stock mutations are written to audit log

### 5.4 Decision Needed

- **DN-STK-01:** On Order Return, does stock return to `available_qty` automatically, or does it require manual Admin confirmation before restocking?
- **DN-STK-02:** On Admin version edit of an Approved order where qty changes, is the stock delta reserved immediately upon version creation, or only upon re-approval?  
  *(Recommendation: Reserve delta on re-approval to avoid blocking stock on a version that may be rejected.)*

---

## 6. Order Versioning

- Admin is the only role that can edit an Approved order
- Editing creates a new version record; the original version record is marked immutable
- The new version inherits all line items from the prior version; Admin edits from there
- A full diff is stored in audit (field-level: what changed, old value, new value, who, when)
- The new version requires Manager re-approval before it can proceed to Fulfilled
- Stock is rechecked at re-approval, not at edit time
- Version numbers are sequential integers per order (Order #1001 v1, v2, v3…)

---

## 7. Reporting

### 7.1 Available Reports (v1)

| Report | Filterable By |
|---|---|
| Sales by Date | Date range |
| Sales by Manager | Manager, date range |
| Sales by Client | Client, date range |
| Sales by Product | Product/variant, date range |

### 7.2 Export Formats

- CSV export (all reports)
- PDF export (all reports)
- Filtered export (export applies current active filters)

### 7.3 Access

- Admin and Manager can access all reports
- Agent: Decision Needed (see DN-RPT-01)
- Client: cannot access reports

### 7.4 Decision Needed

- **DN-RPT-01:** Can Agents view any reporting data? If so, is it scoped to their assigned clients only?
- **DN-RPT-02:** Are reports generated in real-time or from a scheduled snapshot? (Performance implication at 100k products.)

---

## 8. Multi-Language Support

- System supports three languages: English (default), Armenian, Russian
- Product names, descriptions, and category names are stored as multilingual JSON objects
- Users can switch their language at any time via UI setting
- Super Admin manages UI translation strings (static UI labels, button text, error messages) via admin panel
- All three language versions of a product field must be provided when creating/editing a product  

### 8.1 Decision Needed

- **DN-LANG-01:** What happens if a multilingual field is only partially filled (e.g., name exists in English and Russian but not Armenian)? Does the system fall back to English or block the save?

---

## 9. Audit System

- Audit log is append-only; no record is ever physically deleted
- "Log clearing" by Super Admin performs a soft delete (records marked cleared, not removed)
- The clearing action itself is written to the audit log before clearing occurs
- Events that must be logged:

| Event | Data Captured |
|---|---|
| Order created | Order ID, Agent ID, timestamp |
| Order edited (Draft) | Order ID, Agent ID, changed fields, timestamp |
| Order submitted | Order ID, Agent ID, timestamp |
| Order approved | Order ID, Manager ID, timestamp |
| Order rejected | Order ID, Manager ID, reason (if provided), timestamp |
| Order fulfilled | Order ID, Manager ID, timestamp |
| Order cancelled | Order ID, actor ID, role, timestamp |
| Order returned | Order ID, actor ID, role, timestamp |
| New version created | Order ID, version number, Admin ID, diff, timestamp |
| Price override | Order ID, line item, Manager ID, original price, override price, timestamp |
| Stock adjusted | Variant ID, warehouse ID, old qty, new qty, Admin ID, reason, timestamp |
| Login attempt | User ID (or attempted username), success/fail, IP, timestamp |
| Permission/role change | Target user ID, changed by, old role, new role, timestamp |
| Log clearing event | Cleared by, scope, timestamp |

---

## 10. Authentication & Security

- JWT-based authentication with refresh token rotation
- RBAC enforced server-side (client-side enforcement is cosmetic only)
- Every API request carries a `correlation_id` for tracing
- Rate limiting applied to all endpoints
- Input validation via Zod server-side on all requests
- Structured logging format (machine-readable)
- Security level: Medium (no PCI/HIPAA requirements in v1)

---

## 11. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Product catalog scale | 100,000 products |
| Client scale | 300–1,000 clients |
| Order throughput | 50–100 orders/day |
| Concurrent users | 20 |
| Search indexing | SKU and product name indexed from day one |
| Pagination | Mandatory on all list views |
| Horizontal scaling | Not required in v1 |
| Deployment | Dockerized Postgres, single backend service, modular monolith |
| Frontend | Responsive web (mobile-responsive, not native app) |
| Availability SLA | **Decision Needed — DN-NFR-01** |
| Data backup policy | **Decision Needed — DN-NFR-02** |
| Session timeout | **Decision Needed — DN-NFR-03** |

---

## 12. Decision Needed — Master List

| ID | Area | Question |
|---|---|---|
| DN-PRICE-01 | Pricing | Is Manager price override per line item or per whole order? |
| DN-PRICE-02 | Pricing | Does retroactive group discount change affect existing Draft orders? |
| DN-STK-01 | Inventory | On Return, does stock auto-restock or require Admin confirmation? |
| DN-STK-02 | Inventory | Is stock delta reserved at Admin edit or at re-approval? |
| DN-RPT-01 | Reporting | Can Agents access reports? Scoped to their clients? |
| DN-RPT-02 | Reporting | Are reports real-time or snapshot-based? |
| DN-LANG-01 | Translations | Fallback behavior for partially filled multilingual fields? |
| DN-NFR-01 | Non-Functional | Availability/uptime SLA requirement? |
| DN-NFR-02 | Non-Functional | Data backup frequency and retention policy? |
| DN-NFR-03 | Non-Functional | Session timeout duration? |
| DN-ORD-01 | Orders | Can a Manager provide a rejection reason? Is it mandatory? |
| DN-ORD-02 | Orders | Who can cancel an Approved order — Manager only, or Admin too? |
