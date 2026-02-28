# 03_USER_STORIES.md
## MaxMarket — User Stories
**Version:** 1.0  
**Status:** Baseline Locked

---

## Format

> **As a** [role], **I want to** [action], **so that** [business value].  
> **MVP / Future** label on each story.  
> Stories are grouped by role then domain.

---

## SUPER ADMIN

### System Configuration

**SA-01 — Language Management (MVP)**  
As a Super Admin, I want to add or edit supported UI languages and their translation strings, so that all users can operate the platform in their preferred language.

**SA-02 — User Role Management (MVP)**  
As a Super Admin, I want to create user accounts, assign roles, and change a user's role at any time, so that I can control who has access to what within the system.

**SA-03 — Audit Log Governance (MVP)**  
As a Super Admin, I want to soft-delete (clear) audit log entries, so that I can perform log housekeeping — knowing that the clearing action itself is permanently recorded.

**SA-04 — Full System Visibility (MVP)**  
As a Super Admin, I want to access any area of the system without restriction, so that I can support, audit, and configure any part of the platform.

---

## ADMIN

### Order Management

**AD-01 — Edit Approved Order (MVP)**  
As an Admin, I want to edit an Approved order, so that I can correct errors or adjust terms — with the system automatically creating a new version and requiring re-approval.

**AD-02 — View All Orders (MVP)**  
As an Admin, I want to view all orders regardless of status, agent, or client, so that I have complete business oversight.

**AD-03 — Cancel Approved Order (MVP)**  
As an Admin, I want to cancel an Approved order, so that stock is released and the order is closed when fulfillment is no longer possible.

### Pricing

**AD-04 — Manage Pricing Rules (MVP)**  
As an Admin, I want to set and edit base prices and group discount rules per product variant, so that the pricing engine reflects current business agreements.

### Inventory

**AD-05 — Adjust Stock (MVP)**  
As an Admin, I want to manually adjust the available quantity of any product variant in the warehouse, so that the system reflects actual physical stock after counts or corrections.

**AD-06 — View Full Stock Data (MVP)**  
As an Admin, I want to view current available and reserved quantities for all variants, so that I can identify stock risks and manage reordering.

### Reporting

**AD-07 — Generate Sales Reports (MVP)**  
As an Admin, I want to generate sales reports filtered by date, manager, client, or product, so that I can analyze business performance.

**AD-08 — Export Reports (MVP)**  
As an Admin, I want to export any report as CSV or PDF, so that I can share or archive results outside the system.

---

## MANAGER

### Order Approval

**MG-01 — View Submitted Orders Queue (MVP)**  
As a Manager, I want to see all orders in Submitted status, so that I know which orders are awaiting my review.

**MG-02 — Approve Order (MVP)**  
As a Manager, I want to approve a Submitted order, so that stock is reserved and the order moves toward fulfillment.

**MG-03 — Reject Order (MVP)**  
As a Manager, I want to reject a Submitted order, so that the Agent is informed and can create a revised order.

**MG-04 — Override Line Item Price Before Approval (MVP)**  
As a Manager, I want to override the price of a line item before approving an order, so that I can apply special pricing agreed outside the standard rules.

**MG-05 — Mark Order as Fulfilled (MVP)**  
As a Manager, I want to mark an Approved order as Fulfilled, so that stock quantities are decremented and the order is closed operationally.

### Visibility

**MG-06 — View All Clients (MVP)**  
As a Manager, I want to view all clients in the system, so that I can look up order history and account details for any client.

**MG-07 — View Stock and Cost Price (MVP)**  
As a Manager, I want to view stock levels and cost prices, so that I can make informed approval and pricing decisions.

### Reporting

**MG-08 — Generate Sales Reports (MVP)**  
As a Manager, I want to generate and export sales reports, so that I can track performance within my scope of responsibility.

---

## AGENT

### Order Creation

**AG-01 — Create Draft Order for Assigned Client (MVP)**  
As an Agent, I want to create a new Draft order for one of my assigned clients, so that I can begin building an order based on the client's needs.

**AG-02 — Add Product Variants to Order (MVP)**  
As an Agent, I want to add product variants to a Draft order and specify quantities, so that the order reflects what the client wants to buy.

**AG-03 — Edit a Draft Order (MVP)**  
As an Agent, I want to edit any line item in a Draft order, so that I can correct mistakes or update quantities before submitting.

**AG-04 — Delete a Draft Order (MVP)**  
As an Agent, I want to delete a Draft order I created, so that I can remove orders that are no longer needed.

**AG-05 — Submit an Order (MVP)**  
As an Agent, I want to submit a Draft order for approval, so that a Manager can review and approve it.

**AG-06 — View Client-Specific Pricing While Building Order (MVP)**  
As an Agent, I want to see the client's group-discounted price while building an order, so that I can set accurate expectations with the client.

### Catalog & Clients

**AG-07 — View Assigned Clients Only (MVP)**  
As an Agent, I want to see only my assigned clients when searching or creating orders, so that I cannot access or accidentally order for clients outside my territory.

**AG-08 — View Product Catalog with Stock (MVP)**  
As an Agent, I want to browse the product catalog including current stock levels, so that I don't create orders for out-of-stock items.

**AG-09 — Search Products by SKU or Name (MVP)**  
As an Agent, I want to search for products by SKU or name, so that I can find the right variant quickly.

---

## CLIENT

### Catalog

**CL-01 — Browse Product Catalog (MVP)**  
As a Client, I want to browse the product catalog, so that I can see what products are available from the wholesaler.

**CL-02 — View My Group-Discounted Prices (MVP)**  
As a Client, I want to see the prices applicable to my account when browsing the catalog, so that I know what I will be charged.

**CL-03 — Filter Catalog by Category (MVP)**  
As a Client, I want to filter the catalog by product category, so that I can find relevant products without scrolling the full catalog.

**CL-04 — Search Catalog by SKU or Name (MVP)**  
As a Client, I want to search the catalog by SKU or product name, so that I can find a specific product quickly.

### Order History & Tracking

**CL-05 — View My Order History (MVP)**  
As a Client, I want to view a list of all my orders with their current statuses, so that I can track what I've ordered and where each order stands.

**CL-06 — View Order Details (MVP)**  
As a Client, I want to click into any order and see its full line items, quantities, and prices, so that I have a clear record of what was ordered.

**CL-07 — Switch Language (MVP)**  
As a Client, I want to switch the platform language between English, Armenian, and Russian, so that I can use the platform in my preferred language.

---

## FUTURE STORIES (v2+)

**FT-01 — Multi-Warehouse Stock View (Future)**  
As an Admin, I want to view and manage stock across multiple warehouses, so that I can manage distribution from several physical locations.

**FT-02 — Accounting Sync Status (Future)**  
As an Admin, I want to see the sync status of each order with the external accounting system, so that I can identify and resolve sync failures.

**FT-03 — Delivery Tracking (Future)**  
As a Client, I want to track the delivery status of my Fulfilled order, so that I know when to expect arrival.

**FT-04 — Mobile App — Agent (Future)**  
As an Agent, I want to create and submit orders from a mobile app, so that I can work in the field without needing a laptop.

**FT-05 — Mobile App — Client (Future)**  
As a Client, I want to browse my catalog and order history from a mobile app, so that I can check details on the go.
