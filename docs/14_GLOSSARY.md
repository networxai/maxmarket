# 14_GLOSSARY.md
## MaxMarket — Glossary
**Version:** 1.0  
**Status:** Baseline Locked

---

All terms are defined as they are used within the MaxMarket system. Where a term carries a specific technical meaning different from its common use, that distinction is noted.

---

## A

**Admin**  
A system role with full business control. An Admin can edit approved orders (creating new versions), modify pricing rules, adjust stock, and view all data. An Admin cannot approve or reject orders. See: Roles.

**Append-Only**  
A write pattern in which records are only ever inserted, never updated or deleted. The MaxMarket audit log is append-only. Soft deletes mark records as cleared but do not remove them.

**Approval**  
The act by which a Manager transitions an order from Submitted status to Approved status. Approval is all-or-nothing (no partial approval). Approval is blocked if any line item has insufficient stock.

**Approved (Order Status)**  
An order state indicating a Manager has reviewed and approved the order. In this state, stock is reserved. The order may proceed to Fulfilled, be Cancelled, or be edited by Admin (creating a new version).

**Audit Log**  
An append-only record of all significant system events. See PRD Section 9 for the full list of audited events. No record is ever physically deleted. Log clearing is a soft delete and is itself logged.

**available_qty**  
The current physically available stock for a product variant in a given warehouse. This quantity is decremented only upon Fulfillment. It must always be ≥ reserved_qty. Stock adjustments may not reduce available_qty below reserved_qty.

---

## B

**Base Price**  
The standard price of a product variant before any group discount is applied. Set by Admin. Formula: `Client Price = base_price - group_discount`.

**B2B (Business-to-Business)**  
MaxMarket operates as a closed B2B platform — it serves wholesale buyer businesses (clients), not individual consumers. Clients are registered accounts, not anonymous buyers.

---

## C

**Cancelled (Order Status)**  
A terminal order state. An Approved order that has been cancelled. Reserved stock is released upon cancellation. A cancelled order cannot be reactivated.

**Catalog**  
The collection of all products and their variants available on the platform. Anonymous users can view the catalog without pricing. Registered clients see the catalog with their group-discounted prices.

**Client**  
A registered wholesale buyer company or individual. In MaxMarket, Clients cannot create orders; orders are always created on their behalf by Agents. Clients have read-only access to the catalog (with their pricing) and their own order history.

**Client Group**  
A classification assigned to each Client that determines which discount rule applies to their pricing. All clients in the same group receive the same group discount.

**correlation_id**  
A unique identifier attached to every API request and propagated through all log entries generated during that request. Used for distributed tracing and debugging. Returned in response headers.

**Cost Price**  
The internal purchase/cost price of a product variant. Visible to Admin, Manager, and Agent. Not visible to Clients.

---

## D

**Draft (Order Status)**  
The initial state of an order created by an Agent. A Draft order is editable and can be deleted by the creating Agent. It has not yet been submitted for approval.

**Decision Needed (DN)**  
A tag used throughout the product documentation to flag an open question that requires business or stakeholder input before the feature can be fully specified or built. Each DN item has a unique ID (e.g., DN-PRICE-01).

---

## F

**Fulfilled (Order Status)**  
An order state indicating the physical goods have been dispatched or delivered. Upon fulfillment: reserved_qty is decremented and available_qty is decremented. A Fulfilled order may be transitioned to Returned.

---

## G

**Group Discount**  
A discount value applied to the base price of product variants for all members of a given client group. Assigned and managed by Admin. No discount stacking occurs — pricing is deterministic.

---

## I

**Immutable**  
A record that cannot be changed after reaching a certain state. In MaxMarket, all prior order versions become immutable when a new version is created. Audit log records are always immutable.

---

## J

**JWT (JSON Web Token)**  
The authentication mechanism used by MaxMarket. Users receive an access token (short-lived) and a refresh token (longer-lived). Refresh token rotation is applied. RBAC is enforced server-side regardless of token claims.

---

## L

**Line Item**  
A single product variant entry within an order, including the variant, quantity, unit price, and total. An order is composed of one or more line items.

**Log Clearing**  
A Super Admin action that soft-deletes audit log entries. The clearing event itself is logged before any records are marked. Cleared records remain in the database but are hidden from the default audit log view.

---

## M

**Manager**  
A system role responsible for approving or rejecting submitted orders and marking approved orders as fulfilled. A Manager can also override line item prices before approval. Managers cannot create or edit orders.

**Minimum Order Quantity (MOQ)**  
The minimum number of units required to order a given product variant. Enforced at line item entry time. An Agent cannot add a line item with a quantity below the MOQ.

**Modular Monolith**  
The v1 architectural pattern: a single deployable backend service internally organized into distinct modules (e.g., orders, inventory, catalog, auth). Designed to allow future decomposition into microservices without v1 refactoring.

**Multilingual JSON**  
The storage format for translatable product fields (name, description, category name). A single field stores all language values as a JSON object, e.g., `{"en": "Apple", "hy": "Խնձոր", "ru": "Яблоко"}`.

---

## O

**Order**  
The primary transactional entity in MaxMarket. An order is created by an Agent on behalf of a Client, contains one or more line items, and passes through a defined state machine from Draft to a terminal state.

**Order Version**  
When an Admin edits an Approved order, a new version is created. Version numbers are sequential integers (v1, v2, v3…). All prior versions are immutable. The new version requires re-approval.

---

## P

**Pagination**  
Mandatory on all list views in MaxMarket. No list view renders an unbounded set of records. Required for performance compliance at 100,000-product scale.

**Price Override**  
A Manager's ability to replace the calculated group-discounted price for a line item on a specific order before approving. The override is logged in the audit system. Only the final (override) price is visible in the UI.

**Product Variant**  
A specific sellable configuration of a product (e.g., different size, color, or packaging). Each variant has its own SKU, stock record, price, images, unit type, and MOQ.

---

## R

**RBAC (Role-Based Access Control)**  
The permission model used in MaxMarket. Every action is controlled by the user's assigned role. RBAC is enforced server-side; client-side UI restrictions are cosmetic only.

**Rejected (Order Status)**  
A terminal order state. A Submitted order that a Manager has rejected. No stock is affected. The Agent must create a new Draft order if they wish to resubmit.

**reserved_qty**  
The quantity of a product variant that is currently reserved against approved orders but not yet fulfilled. Incremented at Approval; decremented at Fulfillment or Cancellation.

**Returned (Order Status)**  
A terminal order state for a Fulfilled order where the goods have been returned. The exact stock restock behavior on return is a Decision Needed item (DN-STK-01).

---

## S

**SKU (Stock Keeping Unit)**  
A unique alphanumeric code identifying a specific product variant. Indexed for search in MaxMarket.

**Soft Delete**  
A deletion pattern where a record is marked as deleted/inactive but remains physically in the database. MaxMarket uses soft delete for all user-facing deletions and audit log clearing.

**Stock Recheck**  
A system validation that confirms sufficient available_qty exists for all line items in an order. Triggered at: initial approval, and re-approval after Admin version edit.

**Submitted (Order Status)**  
The state of an order after an Agent has submitted it for approval. A Submitted order is locked from Agent editing and awaits Manager review.

**Super Admin**  
The highest-privilege system role. A Super Admin has full access to all areas of the system, manages user roles, controls system configuration and language management, and governs audit logs.

---

## U

**Unit Type**  
The unit in which a product variant is sold. Supported values: piece, box, kg. Determines how quantity and pricing are calculated.

---

## V

**v1 / v2**  
Version designations for the MaxMarket platform. v1 is the initial release (MVP). v2 refers to planned future capabilities including multi-warehouse, accounting sync, delivery tracking, and mobile apps. Features explicitly marked as v2 are not implemented in v1 but must not be architecturally blocked.

**Variant**  
See: Product Variant.

---

## W

**Warehouse**  
A physical location where stock is held. v1 operates with a single warehouse. The data model supports multiple warehouses to allow v2 multi-warehouse expansion without schema redesign.

**warehouse_stock**  
The database table (or equivalent entity) that tracks stock per warehouse per product variant. Contains: warehouse_id, product_variant_id, available_qty, reserved_qty.
