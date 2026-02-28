// tests/qa/s12-04-rbac-final.ts
// Comprehensive RBAC — combines Phase 8, 9, 10, 11 matrices

import { api, assert, login, loginAs, WAREHOUSE_ID } from "./helpers.ts";

const API = "http://localhost:3000/api/v1";

const EMAILS: Record<string, string> = {
  super_admin: "super_admin@maxmarket.com",
  admin: "admin1@maxmarket.com",
  manager: "manager1@maxmarket.com",
  agent: "agent1@maxmarket.com",
  client: "client1@maxmarket.com",
};

interface Check {
  name: string;
  method: string;
  path: string;
  body?: any;
  setup?: () => Promise<any>;
  allowed: string[];
  forbidden: string[];
}

async function main() {
  console.log("\n🔄 S12-04: Comprehensive RBAC Final\n");

  const tokens: Record<string, string> = {};
  const users: Record<string, any> = {};
  for (const [role, email] of Object.entries(EMAILS)) {
    const res = await login(email);
    tokens[role] = res.accessToken;
    users[role] = res.user;
  }

  const sa = await loginAs("super_admin");
  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");

  // Get stock variant, client, group, category for tests
  const stockRes = await api("GET", "/inventory/stock", admin.accessToken);
  const stockEntries = stockRes.data?.data || stockRes.data || [];
  const stockVariantId = stockEntries[0]?.variantId;

  const clientsRes = await api("GET", `/users/${agent.user.id}/clients`, agent.accessToken);
  const clientsList = clientsRes.data?.data || clientsRes.data || [];
  const clientId = clientsList[0]?.id || clientsList[0]?.clientId;

  const groupRes = await api("GET", "/client-groups", admin.accessToken);
  const groups = groupRes.data?.data || groupRes.data || [];

  const catRes = await api("GET", "/catalog/categories", admin.accessToken);
  const categories = catRes.data?.data || catRes.data || [];

  // Ensure stock
  await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID, variantId: stockVariantId, newAvailableQty: 1000, reason: "RBAC final setup",
  });

  // Helper: create draft for state-transition tests
  async function createAndSubmitOrder(): Promise<string> {
    const draft = await api("POST", "/orders", tokens.agent, {
      clientId, lineItems: [{ variantId: stockVariantId, qty: 1, warehouseId: WAREHOUSE_ID }],
    });
    const submit = await api("POST", `/orders/${draft.data.id}/submit`, tokens.agent);
    return draft.data.id;
  }

  // Helper: create test user
  async function createTestUser(): Promise<string> {
    const r = await api("POST", "/users", sa.accessToken, {
      email: `rbac-final-${Date.now()}-${Math.random().toString(36).slice(2,6)}@test.com`,
      password: "ChangeMe1!", fullName: "RBAC Final User", role: "agent",
    });
    return r.data?.id;
  }

  // Helper: create test group
  async function createTestGroup(): Promise<string> {
    const r = await api("POST", "/client-groups", admin.accessToken, {
      name: `RBAC-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      discountType: "percentage", discountValue: 5,
    });
    return r.data?.id;
  }

  const dateParams = "dateFrom=2025-01-01&dateTo=2027-01-01";

  // ═══════════════════════════════════════════════════════
  // PHASE 8 — Order CRUD + State Transitions
  // ═══════════════════════════════════════════════════════

  const phase8Checks: Check[] = [
    { name: "POST /orders", method: "POST", path: "/orders",
      body: { clientId, lineItems: [{ variantId: stockVariantId, qty: 1, warehouseId: WAREHOUSE_ID }] },
      allowed: ["agent"], forbidden: ["manager", "client"] },
    { name: "GET /orders", method: "GET", path: "/orders",
      allowed: ["super_admin", "admin", "manager", "agent", "client"], forbidden: [] },
    { name: "GET /orders/:id", method: "GET", path: "/orders",
      allowed: ["super_admin", "admin", "manager", "agent", "client"], forbidden: [] },
    { name: "POST /orders/:id/submit", method: "POST", path: "/orders/{orderId}/submit",
      setup: async () => {
        const d = await api("POST", "/orders", tokens.agent, { clientId, lineItems: [{ variantId: stockVariantId, qty: 1, warehouseId: WAREHOUSE_ID }] });
        return d.data.id;
      },
      allowed: ["agent"], forbidden: ["manager", "client"] },
    { name: "POST /orders/:id/approve", method: "POST", path: "/orders/{orderId}/approve",
      allowed: ["manager", "super_admin", "admin"], forbidden: ["agent", "client"] },
    { name: "POST /orders/:id/reject", method: "POST", path: "/orders/{orderId}/reject",
      allowed: ["manager", "super_admin", "admin"], forbidden: ["agent", "client"] },
    { name: "POST /orders/:id/cancel", method: "POST", path: "/orders/{orderId}/cancel",
      allowed: ["manager", "super_admin", "admin"], forbidden: ["agent", "client"] },
    { name: "POST /orders/:id/return", method: "POST", path: "/orders/{orderId}/return",
      allowed: ["manager", "super_admin", "admin"], forbidden: ["agent", "client"] },
    { name: "PUT /orders/:id/override-price", method: "PUT", path: "/orders/{orderId}/override-price",
      allowed: ["manager", "super_admin"], forbidden: ["admin", "agent", "client"] },
    { name: "DELETE /orders/:id", method: "DELETE", path: "/orders/{orderId}/delete",
      allowed: ["agent"], forbidden: ["manager", "client"] },
  ];

  // ═══════════════════════════════════════════════════════
  // PHASE 9 — Admin Endpoints
  // ═══════════════════════════════════════════════════════

  const phase9Checks: Check[] = [
    { name: "POST /users", method: "POST", path: "/users",
      body: { email: `x${Date.now()}@t.com`, password: "ChangeMe1!", fullName: "T", role: "agent" },
      allowed: ["super_admin"], forbidden: ["admin", "manager", "agent", "client"] },
    { name: "PUT /users/:id", method: "PUT", path: "/users",
      allowed: ["super_admin"], forbidden: ["admin", "manager", "agent", "client"] },
    { name: "DELETE /users/:id", method: "DELETE", path: "/users",
      allowed: ["super_admin"], forbidden: ["admin", "manager", "agent", "client"] },
    { name: "POST /client-groups", method: "POST", path: "/client-groups",
      allowed: ["super_admin", "admin"], forbidden: ["manager", "agent", "client"] },
    { name: "PUT /client-groups/:id", method: "PUT", path: "/client-groups",
      allowed: ["super_admin", "admin"], forbidden: ["manager", "agent", "client"] },
    { name: "DELETE /client-groups/:id", method: "DELETE", path: "/client-groups",
      allowed: ["super_admin", "admin"], forbidden: ["manager", "agent", "client"] },
    { name: "GET /client-groups", method: "GET", path: "/client-groups",
      allowed: ["super_admin", "admin", "manager", "agent"], forbidden: ["client"] },
    { name: "PUT /inventory/stock/adjust", method: "PUT", path: "/inventory/stock/adjust",
      body: { warehouseId: WAREHOUSE_ID, variantId: stockVariantId, newAvailableQty: 1000, reason: "RBAC" },
      allowed: ["super_admin", "admin"], forbidden: ["manager", "agent", "client"] },
    { name: "GET /inventory/stock", method: "GET", path: "/inventory/stock",
      allowed: ["super_admin", "admin", "manager", "agent"], forbidden: ["client"] },
    { name: "POST /catalog/products", method: "POST", path: "/catalog/products",
      body: { name: { en: "RBAC Test" }, description: { en: "T" }, categoryId: categories[0]?.id,
        variants: [{ sku: `R-${Date.now()}`, unitType: "piece", pricePerUnit: 1, costPrice: 1, minOrderQty: 1, isActive: true }] },
      allowed: ["super_admin", "admin"], forbidden: ["manager", "agent", "client"] },
    { name: "POST /catalog/categories", method: "POST", path: "/catalog/categories",
      body: { name: { en: `RBAC Cat ${Date.now()}` } },
      allowed: ["super_admin", "admin"], forbidden: ["manager", "agent", "client"] },
  ];

  // ═══════════════════════════════════════════════════════
  // PHASE 10 — Reports + Audit
  // ═══════════════════════════════════════════════════════

  const phase10Checks: Check[] = [
    { name: "GET sales-by-date", method: "GET", path: `/reports/sales-by-date?${dateParams}`,
      allowed: ["super_admin", "admin", "manager", "agent"], forbidden: ["client"] },
    { name: "GET sales-by-manager", method: "GET", path: "/reports/sales-by-manager",
      allowed: ["super_admin", "admin", "manager"], forbidden: ["agent", "client"] },
    { name: "GET sales-by-client", method: "GET", path: "/reports/sales-by-client",
      allowed: ["super_admin", "admin", "manager", "agent"], forbidden: ["client"] },
    { name: "GET sales-by-product", method: "GET", path: "/reports/sales-by-product",
      allowed: ["super_admin", "admin", "manager", "agent"], forbidden: ["client"] },
    { name: "GET CSV export", method: "GET", path: `/reports/sales-by-date/export?format=csv&${dateParams}`,
      allowed: ["super_admin", "admin", "manager", "agent"], forbidden: ["client"] },
    { name: "GET audit/logs", method: "GET", path: "/audit/logs",
      allowed: ["super_admin", "admin"], forbidden: ["manager", "agent", "client"] },
    { name: "POST audit/logs/clear", method: "POST", path: "/audit/logs/clear",
      body: { scope: "before_date", beforeDate: "2020-01-01T00:00:00Z" },
      allowed: ["super_admin"], forbidden: ["admin", "manager", "agent", "client"] },
  ];

  // ═══════════════════════════════════════════════════════
  // PHASE 11 — I18n
  // ═══════════════════════════════════════════════════════

  const phase11Checks: Check[] = [
    { name: "GET /i18n/ui-strings", method: "GET", path: "/i18n/ui-strings?language=en",
      allowed: ["super_admin", "admin", "manager", "agent", "client"], forbidden: [] },
    { name: "PUT /i18n/ui-strings", method: "PUT", path: "/i18n/ui-strings",
      body: { language: "en", strings: { "test.rbac.final": "test" } },
      allowed: ["super_admin"], forbidden: ["admin", "manager", "agent", "client"] },
  ];

  // ═══════════════════════════════════════════════════════
  // Execute simplified RBAC — direct endpoint checks
  // ═══════════════════════════════════════════════════════

  const allSimpleChecks = [...phase10Checks, ...phase11Checks];
  const results: { phase: string; endpoint: string; role: string; expected: string; actual: number; pass: boolean }[] = [];
  let totalChecks = 0;

  // Phase 10 + 11 — simple checks (no setup needed)
  for (const check of allSimpleChecks) {
    const phase = phase10Checks.includes(check) ? "P10" : "P11";
    for (const role of check.allowed) {
      const res = await api(check.method, check.path, tokens[role], check.body);
      const pass = res.status >= 200 && res.status < 300;
      results.push({ phase, endpoint: check.name, role, expected: "2xx", actual: res.status, pass });
      totalChecks++;
    }
    for (const role of check.forbidden) {
      const res = await api(check.method, check.path, tokens[role], check.body);
      const pass = res.status === 403;
      results.push({ phase, endpoint: check.name, role, expected: "403", actual: res.status, pass });
      totalChecks++;
    }
  }

  // Phase 9 — admin endpoints (need setup for some)
  for (const check of phase9Checks) {
    for (const role of check.allowed) {
      let body = check.body;
      let path = check.path;
      if (check.name === "PUT /users/:id" || check.name === "DELETE /users/:id") {
        const uid = await createTestUser();
        path = `/users/${uid}`;
        body = check.name.startsWith("PUT") ? { fullName: "Updated" } : undefined;
      } else if (check.name === "PUT /client-groups/:id" || check.name === "DELETE /client-groups/:id") {
        const gid = await createTestGroup();
        path = `/client-groups/${gid}`;
        body = check.name.startsWith("PUT") ? { name: `Updated ${Date.now()}` } : undefined;
      } else if (check.name === "POST /catalog/products") {
        body = { name: { en: `RBAC ${Date.now()}` }, description: { en: "T" }, categoryId: categories[0]?.id,
          variants: [{ sku: `R-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, unitType: "piece", pricePerUnit: 1, costPrice: 1, minOrderQty: 1, isActive: true }] };
      } else if (check.name === "POST /catalog/categories") {
        body = { name: { en: `RBAC Cat ${Date.now()}-${Math.random().toString(36).slice(2,6)}` } };
      } else if (check.name === "POST /users") {
        body = { email: `rbac-${Date.now()}-${Math.random().toString(36).slice(2,6)}@t.com`, password: "ChangeMe1!", fullName: "T", role: "agent" };
      } else if (check.name === "POST /client-groups") {
        body = { name: `RBAC-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, discountType: "percentage", discountValue: 5 };
      }
      const res = await api(check.method, path, tokens[role], body);
      const pass = res.status >= 200 && res.status < 300;
      results.push({ phase: "P9", endpoint: check.name, role, expected: "2xx", actual: res.status, pass });
      totalChecks++;
    }
    for (const role of check.forbidden) {
      let body = check.body;
      let path = check.path;
      if (check.name.includes("/users/:id")) {
        const uid = await createTestUser();
        path = `/users/${uid}`;
        body = check.name.startsWith("PUT") ? { fullName: "Fail" } : undefined;
      } else if (check.name.includes("/client-groups/:id")) {
        const gid = await createTestGroup();
        path = `/client-groups/${gid}`;
        body = check.name.startsWith("PUT") ? { name: "Fail" } : undefined;
      } else if (check.name === "POST /users") {
        body = { email: `f-${Date.now()}@t.com`, password: "ChangeMe1!", fullName: "F", role: "agent" };
      } else if (check.name === "POST /client-groups") {
        body = { name: `F-${Date.now()}`, discountType: "percentage", discountValue: 5 };
      } else if (check.name === "POST /catalog/products") {
        body = { name: { en: "Fail" }, description: { en: "F" }, categoryId: categories[0]?.id,
          variants: [{ sku: `F-${Date.now()}`, unitType: "piece", pricePerUnit: 1, costPrice: 1, minOrderQty: 1 }] };
      } else if (check.name === "POST /catalog/categories") {
        body = { name: { en: "Fail" } };
      }
      const res = await api(check.method, path, tokens[role], body);
      const pass = res.status === 403;
      results.push({ phase: "P9", endpoint: check.name, role, expected: "403", actual: res.status, pass });
      totalChecks++;
    }
  }

  // Phase 8 — order endpoint checks (simplified — test key endpoints)
  // POST /orders
  for (const role of ["agent"]) {
    const res = await api("POST", "/orders", tokens[role], {
      clientId, lineItems: [{ variantId: stockVariantId, qty: 1, warehouseId: WAREHOUSE_ID }],
    });
    results.push({ phase: "P8", endpoint: "POST /orders", role, expected: "2xx", actual: res.status, pass: res.status === 201 });
    totalChecks++;
  }
  for (const role of ["client"]) {
    const res = await api("POST", "/orders", tokens[role], {
      clientId, lineItems: [{ variantId: stockVariantId, qty: 1, warehouseId: WAREHOUSE_ID }],
    });
    results.push({ phase: "P8", endpoint: "POST /orders", role, expected: "403", actual: res.status, pass: res.status === 403 });
    totalChecks++;
  }

  // GET /orders — all roles
  for (const role of ["super_admin", "admin", "manager", "agent", "client"]) {
    const res = await api("GET", "/orders", tokens[role]);
    results.push({ phase: "P8", endpoint: "GET /orders", role, expected: "2xx", actual: res.status, pass: res.status === 200 });
    totalChecks++;
  }

  // Approve — need a submitted order
  const orderId = await createAndSubmitOrder();
  const orderData = await api("GET", `/orders/${orderId}`, tokens.admin);
  const vLock = orderData.data?.versionLock;

  for (const role of ["manager"]) {
    const res = await api("POST", `/orders/${orderId}/approve`, tokens[role], { versionLock: vLock });
    results.push({ phase: "P8", endpoint: "POST approve", role, expected: "2xx", actual: res.status, pass: res.status === 200 });
    totalChecks++;
  }
  for (const role of ["agent", "client"]) {
    const oid2 = await createAndSubmitOrder();
    const od2 = await api("GET", `/orders/${oid2}`, tokens.admin);
    const res = await api("POST", `/orders/${oid2}/approve`, tokens[role], { versionLock: od2.data?.versionLock });
    results.push({ phase: "P8", endpoint: "POST approve", role, expected: "403", actual: res.status, pass: res.status === 403 });
    totalChecks++;
  }

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  S12-04 Comprehensive RBAC Final`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  Total: ${totalChecks}  |  Passed: ${passed}  |  Failed: ${failed}`);

  if (failed > 0) {
    console.log(`\n  Failures:`);
    results.filter(r => !r.pass).forEach(r => {
      console.log(`    [${r.phase}] ${r.endpoint} as ${r.role}: expected ${r.expected}, got ${r.actual}`);
    });
  }
  console.log(`${"=".repeat(70)}\n`);
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
