# QA Test Plan — MaxMarket Phase 11

**QA Lead:** Claude Agent  
**Date:** 2026-02-27  
**API Base:** `http://localhost:3000/api/v1`  
**Scope:** I18n (string fetch/update, Accept-Language), user profile edit, manager report fix (DL-18), RBAC for i18n

---

## Test Files

| File | Scenario |
|------|----------|
| `tests/qa/s11-01-i18n-fetch.ts` | S11-1: I18n String Fetch |
| `tests/qa/s11-02-i18n-update.ts` | S11-2: I18n String Update |
| `tests/qa/s11-03-accept-language.ts` | S11-3: Accept-Language Header |
| `tests/qa/s11-04-profile-edit.ts` | S11-4: User Profile Edit |
| `tests/qa/s11-05-manager-report.ts` | S11-5: Manager Report Fix (DL-18) |
| `tests/qa/s11-06-rbac-i18n.ts` | S11-6: RBAC for I18n |
| `tests/qa/s11-07-regression.ts` | S11-7: Phase 10 Regression |

---

## S11-1: I18n String Fetch

| Step | Action | Expected |
|------|--------|----------|
| 1 | GET /i18n/ui-strings?language=en (no auth) | 200, object with string values |
| 2 | Verify key `nav.home` exists | Has value |
| 3 | Verify key `orders.status.draft` exists | Has value |
| 4 | GET ?language=hy | 200, has keys |
| 5 | GET ?language=ru | 200, has keys |
| 6 | GET ?language=fr | 422 (invalid) |
| 7 | GET with no language param | 422 or default |

## S11-2: I18n String Update

| Step | Action | Expected |
|------|--------|----------|
| 1 | Super admin: PUT /i18n/ui-strings { language: "en", strings: { "test.qa.key": "QA Test Value" } } | 200 |
| 2 | GET → verify test.qa.key present | Value matches |
| 3 | Update existing key nav.home | 200 |
| 4 | GET → verify nav.home changed | Updated |
| 5 | Verify other keys still exist | Upsert, not replace |
| 6 | Restore nav.home | 200 |
| 7 | Admin → PUT | 403 |
| 8 | Agent → PUT | 403 |
| 9 | Client → PUT | 403 |

## S11-3: Accept-Language Header

| Step | Action | Expected |
|------|--------|----------|
| 1 | GET /catalog/products with Accept-Language: en | English names |
| 2 | GET with Accept-Language: hy | Armenian names (if available) |
| 3 | GET with Accept-Language: ru | Russian names (if available) |
| 4 | GET with no Accept-Language | Defaults to English |
| 5 | Same for /catalog/categories | Localized names |

## S11-4: User Profile Edit

| Step | Action | Expected |
|------|--------|----------|
| 1 | Agent1: GET /users/{ownId} | Current profile |
| 2 | PUT /users/{ownId} { fullName, preferredLanguage: "hy" } | 200, updated |
| 3 | GET → verify persisted | Values match |
| 4 | PUT { role: "admin" } | 403 or field ignored |
| 5 | PUT { isActive: false } | 403 or field ignored |
| 6 | Restore original values | 200 |
| 7 | Client1: edit own profile | Works |

## S11-5: Manager Report Fix (DL-18)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin: GET /reports/sales-by-manager | 200 |
| 2 | Verify rows have managerId/managerName | Fields present |
| 3 | Verify manager1 appears if fulfilled orders exist | Manager in results |
| 4 | Verify grouping by approving manager | Not by agent |

## S11-6: RBAC for I18n (12 checks)

| Endpoint | super_admin | admin | manager | agent | client | public |
|----------|-------------|-------|---------|-------|--------|--------|
| GET /i18n/ui-strings?language=en | 200 | 200 | 200 | 200 | 200 | 200 |
| PUT /i18n/ui-strings | 200 | 403 | 403 | 403 | 403 | 401 |

## S11-7: Phase 10 Regression

| Step | Action | Expected |
|------|--------|----------|
| 1 | GET /reports/sales-by-date | 200, has data |
| 2 | GET CSV export | 200, CSV content |
| 3 | GET /audit/logs as admin | 200, has entries |
| 4 | Agent creates draft | 201 |
