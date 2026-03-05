# 04_ACCEPTANCE_CRITERIA.md
## MaxMarket — Acceptance Criteria
**Version:** 1.0  
**Status:** Baseline Locked

---

## Format

Each story's AC uses Given / When / Then.  
Edge cases and failure scenarios are included inline.

---

## SUPER ADMIN

---

### SA-01 — Language Management

**Given** I am logged in as Super Admin  
**When** I navigate to the language management panel  
**Then** I see a list of all supported languages (English, Armenian, Russian) and their activation status

**Given** I am logged in as Super Admin  
**When** I edit a UI translation string for a given key and save  
**Then** the updated string is reflected in the UI for all users with that language selected within one session reload

**Given** I am logged in as Super Admin  
**When** I attempt to save a translation with a blank value  
**Then** the system blocks the save and shows a validation error

---

### SA-02 — User Role Management

**Given** I am logged in as Super Admin  
**When** I create a new user and assign a role  
**Then** the user account is created, the role is assigned, and the creation is written to the audit log

**Given** I am logged in as Super Admin  
**When** I change an existing user's role  
**Then** the old role and new role are both written to the audit log with timestamp and my user ID

**Given** I am logged in as Super Admin  
**When** I deactivate a user account  
**Then** that user cannot log in and their existing sessions are invalidated

---

### SA-03 — Audit Log Governance

**Given** I am logged in as Super Admin  
**When** I perform a soft-delete (clear) on a set of audit log entries  
**Then** the clearing event is appended to the audit log before any records are marked cleared

**Given** cleared audit entries exist  
**When** any user (including Super Admin) views the audit log  
**Then** cleared entries are not shown in the default view (but remain physically in the database)

---

## ADMIN

---

### AD-01 — Edit Approved Order

**Given** an order is in Approved status  
**When** I (Admin) edit any field of the order and save  
**Then** a new version of the order is created with an incremented version number  
**And** the original version is locked (immutable)  
**And** the new version status is set to Submitted (pending re-approval)  
**And** a full field-level diff is written to the audit log  
**And** a stock recheck is triggered at the point of re-approval (not at edit time)

**Given** I am editing an Approved order  
**When** I try to save and the system encounters a write error mid-operation  
**Then** the original Approved order remains intact and no partial version is persisted  
**And** the system returns a clear error message

**Given** I am logged in as Manager (not Admin)  
**When** I attempt to edit an Approved order  
**Then** the system denies the action and returns a permission error

---

### AD-04 — Manage Pricing Rules

**Given** I am logged in as Admin  
**When** I update the base price of a product variant  
**Then** the new price is immediately applied to all new Draft orders  
**And** the change is written to the audit log

**Given** I am logged in as Admin  
**When** I assign a group discount to a client group  
**Then** all clients in that group see the updated discounted price on their next catalog load

**Given** I attempt to set a base price to a negative value  
**Then** the system blocks the save and shows a validation error

---

### AD-05 — Adjust Stock

**Given** I am logged in as Admin  
**When** I increase the available_qty of a product variant  
**Then** the new quantity is saved and the change (old qty, new qty, my user ID, timestamp) is written to the audit log

**Given** I am logged in as Admin  
**When** I attempt to set available_qty to a value below the current reserved_qty  
**Then** the system blocks the adjustment and shows an error stating the minimum allowable value

**Given** I am logged in as Agent or Client  
**When** I attempt to directly adjust stock  
**Then** the system denies the action with a permission error

---

## MANAGER

---

### MG-02 — Approve Order

**Given** an order is in Submitted status  
**And** all line items have sufficient available_qty  
**When** I (Manager) approve the order  
**Then** the order status changes to Approved  
**And** reserved_qty is incremented by order_qty for each line item  
**And** the approval is written to the audit log

**Given** an order is in Submitted status  
**And** at least one line item has available_qty < order_qty  
**When** I attempt to approve  
**Then** the system blocks approval  
**And** returns an error listing the specific variants with insufficient stock  
**And** the order remains in Submitted status

**Given** two Managers attempt to approve the same order simultaneously  
**When** both approval requests arrive  
**Then** exactly one approval succeeds and the other receives a conflict error

---

### MG-03 — Reject Order

**Given** an order is in Submitted status  
**When** I (Manager) reject the order  
**Then** the order status changes to Rejected  
**And** the rejection is written to the audit log  
**And** no stock is affected

*Decision Needed: DN-ORD-01 — Is a rejection reason field mandatory or optional?*

---

### MG-04 — Override Line Item Price

**Given** I am reviewing a Submitted order before approving  
**When** I override the price of a line item  
**Then** the override price replaces the calculated price for that line item on this order  
**And** the audit log records: Manager ID, order ID, line item ID, original price, override price, timestamp  
**And** only the final (overridden) price is displayed in the UI to any role

**Given** I attempt to set an override price to zero or a negative value  
**Then** the system blocks the save and shows a validation error

---

### MG-05 — Mark Order as Fulfilled

**Given** an order is in Approved status  
**When** I (Manager) mark it as Fulfilled  
**Then** order status changes to Fulfilled  
**And** for each line item: reserved_qty is decremented by order_qty AND available_qty is decremented by order_qty  
**And** the fulfillment event is written to the audit log

**Given** I am logged in as Agent  
**When** I attempt to mark an order as Fulfilled  
**Then** the system denies the action with a permission error

---

## AGENT

---

### AG-01 — Create Draft Order

**Given** I am logged in as Agent  
**When** I create a new order and select a client  
**Then** only clients assigned to me are available in the client selector  
**And** the order is created in Draft status with my Agent ID attached

**Given** I attempt to create an order for a client not assigned to me (via direct API manipulation)  
**Then** the system denies the creation server-side and returns a permission error

---

### AG-02 / AG-03 — Add and Edit Line Items

**Given** I am building a Draft order  
**When** I add a product variant and set a quantity below the variant's minimum order quantity  
**Then** the system blocks the addition and shows the minimum order quantity requirement

**Given** I am building a Draft order  
**When** I set a quantity for a line item  
**Then** I can see the client's group-discounted price per unit and total for that line item in real time

---

### AG-05 — Submit Order

**Given** a Draft order has at least one line item  
**When** I (Agent) submit the order  
**Then** the order status changes to Submitted  
**And** the order is locked from Agent editing  
**And** the submission event is written to the audit log

**Given** I attempt to submit a Draft order with zero line items  
**Then** the system blocks the submission and shows a validation error

**Given** an order is in Submitted status  
**When** I (Agent) attempt to edit it  
**Then** the system denies the action and shows a clear message that the order is awaiting Manager review

---

## CLIENT

---

### CL-01 / CL-02 — Browse Catalog with Pricing

**Given** I am logged in as Client  
**When** I browse the product catalog  
**Then** I see product names, descriptions, images, and my group-discounted price  
**And** I do not see cost price, available_qty, reserved_qty, or any other internal field

**Given** I am not logged in (anonymous user)  
**When** I browse the catalog  
**Then** I see product names, descriptions, and images but no prices

---

### CL-05 / CL-06 — Order History and Detail

**Given** I am logged in as Client  
**When** I navigate to my order history  
**Then** I see only my own orders and their current statuses  
**And** I cannot see any other client's orders even by direct URL manipulation (server-side enforcement)

**Given** I am viewing an order detail  
**When** the order is in any status  
**Then** I see the line items, quantities, unit prices, and total  
**And** I see the current status  
**And** I do not see cost price, Manager approval notes, or any internal operational field

---

## CROSS-ROLE

---

### Authentication

**Given** any user submits valid credentials  
**When** they authenticate  
**Then** they receive a JWT access token and a refresh token  
**And** the login attempt (success) is written to the audit log with IP and timestamp

**Given** any user submits invalid credentials  
**When** they authenticate  
**Then** they receive a generic authentication failure message  
**And** the failed attempt is written to the audit log with IP and timestamp  
**And** no user information is revealed in the error message

**Given** a user's access token has expired  
**When** they call the refresh endpoint with a valid refresh token  
**Then** they receive a new access token  
**And** the old refresh token is invalidated

---

### Search & Performance

**Given** the catalog contains up to 100,000 products  
**When** I search by SKU or product name  
**Then** results are returned in under a defined acceptable time (Decision Needed: DN-NFR-04 — define query SLA)  
**And** results are paginated

**Given** any list view (orders, clients, products, audit log)  
**When** the list is rendered  
**Then** it is paginated and the page size is controlled (no full-table renders)

---

### Rate Limiting

**Given** a client (user or automated agent) exceeds the rate limit on any endpoint  
**When** the next request arrives  
**Then** the system returns HTTP 429 with a retry-after indication  
**And** the rate limiting event is recorded in structured logs

---

### correlation_id Tracing

**Given** any API request arrives at the server  
**When** the request is processed  
**Then** a `correlation_id` is assigned to (or read from) the request  
**And** all log entries generated during that request include the same `correlation_id`  
**And** the `correlation_id` is returned in the response headers

---

## ORDER CANCELLATION

**Given** an order is in Approved status  
**When** Admin or Manager cancels it  
**Then** order status changes to Cancelled  
**And** reserved_qty is decremented by order_qty for each line item  
**And** the cancellation is written to the audit log  
**And** the order cannot be reactivated

---

## ORDER RETURN

**Given** an order is in Fulfilled status  
**When** Manager or Admin marks it as Returned  
**Then** order status changes to Returned  
**And** the return is written to the audit log  
*Decision Needed: DN-STK-01 — stock restock behavior on return*

---

## AUDIT LOG — GENERAL

**Given** any auditable event occurs (see PRD Section 9 for full event list)  
**When** the event is processed  
**Then** an audit record is appended with all required fields (actor, event type, affected entity, old values, new values, timestamp)  
**And** the audit record is never modifiable after creation  
**And** the audit record is not exposed to Agent or Client roles

**Given** the audit write fails  
**When** an auditable state-changing operation is in progress  
**Then** the entire operation is rolled back (audit write and business write are atomic)
