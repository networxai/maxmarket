# MaxMarket Changelog

## v1.0.0 (2026-02-28)

**Tag:** `v1.0.0`  
**Status:** Production-ready  
**Backup:** `backups/maxmarket_v1.0.0_20260228.sql`

### Features

- Full order lifecycle (draft → submit → approve → fulfill/cancel/return)
- Catalog with multilingual products, variant images
- Admin panels (users, client groups, inventory, catalog)
- Reports (4 types + CSV export) with charts
- Audit log viewer with filters and clear
- I18n (English, Armenian, Russian)
- User settings and language preference
- RBAC across 5 roles

### Post-Launch Fixes

- Display names instead of UUIDs (DL-20)
- Currency formatting (Armenian Dram ֏)
- Stock visibility for agents during order creation
- Multi-keyword catalog search
- Report chart and revenue display
- Nav dropdown overlap
- Test data cleanup
- Product images in seed data
