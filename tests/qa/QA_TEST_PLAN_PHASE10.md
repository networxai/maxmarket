# QA Test Plan — MaxMarket Phase 10

**QA Lead:** Claude Agent  
**Date:** 2026-02-27  
**API Base:** `http://localhost:3000/api/v1`  
**Scope:** Reports (4 types + CSV export), Audit log viewer + clear, Auto-stock on variant creation (DL-17)

---

## Overview

Phase 10 adds reporting, audit logging, and CSV export endpoints. Testing verifies data accuracy, role scoping, RBAC, and the DL-17 auto-stock fix.

### Test Files

| File | Scenario |
|------|----------|
| `tests/qa/s10-01-sales-by-date.ts` | S10-1: Sales by Date Report |
| `tests/qa/s10-02-sales-by-manager.ts` | S10-2: Sales by Manager Report |
| `tests/qa/s10-03-sales-by-client.ts` | S10-3: Sales by Client Report |
| `tests/qa/s10-04-sales-by-product.ts` | S10-4: Sales by Product Report |
| `tests/qa/s10-05-csv-export.ts` | S10-5: CSV Export |
| `tests/qa/s10-06-audit-logs.ts` | S10-6: Audit Log Viewer |
| `tests/qa/s10-07-audit-clear.ts` | S10-7: Audit Log Clear |
| `tests/qa/s10-08-auto-stock.ts` | S10-8: Auto-Stock on Variant Creation (DL-17) |
| `tests/qa/s10-09-rbac-reports-audit.ts` | S10-9: RBAC Matrix |
| `tests/qa/s10-10-regression.ts` | S10-10: Phase 9 Regression |

---

## S10-1: Sales by Date Report

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin: GET /reports/sales-by-date?dateFrom=2025-01-01&dateTo=2027-01-01 | 200, array of SalesReportRow |
| 2 | Verify each row has: date, orderCount, totalRevenue | Fields present |
| 3 | Verify only fulfilled orders counted | orderCount matches fulfilled count |
| 4 | Agent1: same request | 200, scoped to agent1's clients |
| 5 | Client1: same request | 403 |

## S10-2: Sales by Manager Report

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin: GET /reports/sales-by-manager | 200, array of SalesByManagerRow |
| 2 | Verify each row has: managerId, managerName, orderCount, totalRevenue | Fields present |
| 3 | Agent1: same request | 403 |
| 4 | Client1: same request | 403 |

## S10-3: Sales by Client Report

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin: GET /reports/sales-by-client | 200, all clients |
| 2 | Agent1: same request | 200, only assigned clients |
| 3 | Filter: ?clientId={id} | Only that client's data |
| 4 | Client1: same request | 403 |

## S10-4: Sales by Product Report

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin: GET /reports/sales-by-product | 200, all products |
| 2 | Agent1: same request | 200, scoped |
| 3 | Filter: ?variantId={id} | Only that variant |
| 4 | Client1: same request | 403 |

## S10-5: CSV Export

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin: GET /reports/sales-by-date/export?format=csv&dateFrom=2025-01-01&dateTo=2027-01-01 | 200, Content-Type: text/csv |
| 2 | Verify response is valid CSV (header + data rows) | Parseable CSV |
| 3 | Admin: format=pdf | 501, NOT_IMPLEMENTED |
| 4 | Repeat CSV for sales-by-manager, sales-by-client, sales-by-product | 200 each |
| 5 | Agent CSV export | 200, scoped data |
| 6 | Client CSV export | 403 |

## S10-6: Audit Log Viewer

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin: GET /audit/logs | 200, paginated |
| 2 | Verify: id, eventType, actorId, createdAt present | Fields present |
| 3 | Filter: ?eventType=order.created | Only order.created events |
| 4 | Filter: ?actorId={agent1Id} | Only agent1's actions |
| 5 | Filter: ?dateFrom=2026-01-01&dateTo=2026-12-31 | Date range works |
| 6 | Filter: ?targetType=order&targetId={orderId} | Events for specific order |
| 7 | Default: cleared entries NOT shown | No cleared entries |
| 8 | ?includeCleared=true | Cleared entries visible |
| 9 | Manager/Agent/Client: GET /audit/logs | 403 |

## S10-7: Audit Log Clear

| Step | Action | Expected |
|------|--------|----------|
| 1 | Super admin: POST /audit/logs/clear { scope: "before_date", beforeDate: "2020-01-01" } | 200, clearedCount integer |
| 2 | Perform action to create fresh audit entry | Entry created |
| 3 | Clear with beforeDate = now | Clears older entries |
| 4 | Verify clearing event visible in GET /audit/logs | Present |
| 5 | Verify ?includeCleared=true shows cleared entries | Cleared entries visible |
| 6 | Admin: POST clear | 403 |
| 7 | Manager: POST clear | 403 |

## S10-8: Auto-Stock on Variant Creation (DL-17)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin: create product with variant | 201 |
| 2 | GET /inventory/stock?variantId={id} | Row exists, availableQty=0, reservedQty=0 |
| 3 | Adjust stock to 50 | 200 |
| 4 | Agent: create order → submit → manager approve | All succeed |

## S10-9: RBAC Matrix (35 checks)

| Endpoint | super_admin | admin | manager | agent | client |
|----------|-------------|-------|---------|-------|--------|
| GET sales-by-date | 200 | 200 | 200 | 200 | 403 |
| GET sales-by-manager | 200 | 200 | 200 | 403 | 403 |
| GET sales-by-client | 200 | 200 | 200 | 200 | 403 |
| GET sales-by-product | 200 | 200 | 200 | 200 | 403 |
| GET export CSV | 200 | 200 | 200 | 200 | 403 |
| GET audit/logs | 200 | 200 | 403 | 403 | 403 |
| POST audit/logs/clear | 200 | 403 | 403 | 403 | 403 |

## S10-10: Phase 9 Regression

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create user → edit → deactivate | Works |
| 2 | Client group CRUD | Works |
| 3 | Stock adjust | Works |
| 4 | Product create → variant has stock row (DL-17) | Row exists |

---

## Bug Reporting Format

```
BUG-P10-XXX: <title>
- Endpoint: <method> <path>
- Role: <role>
- Expected: <status/response>
- Actual: <status/response>
- Correlation ID: <id>
```
