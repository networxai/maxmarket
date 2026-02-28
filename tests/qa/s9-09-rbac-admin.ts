// tests/qa/s9-09-rbac-admin.ts
// S9-9: RBAC for Admin Endpoints

import {
  api, assert, login, resetCounters, printSummary, loginAs, WAREHOUSE_ID,
} from "./helpers.ts";

const ROLES: Record<string, string> = {
  super_admin: "super_admin@maxmarket.com",
  admin: "admin1@maxmarket.com",
  manager: "manager1@maxmarket.com",
  agent: "agent1@maxmarket.com",
  client: "client1@maxmarket.com",
};

interface RbacEntry {
  name: string;
  setup: () => Promise<any>;
  test: (token: string, data: any) => Promise<{ status: number; data: any; correlationId: string }>;
  allowed: string[];
  forbidden: string[];
}

async function main() {
  resetCounters();
  console.log("\n🔄 S9-9: RBAC for Admin Endpoints\n");

  // Pre-login all roles
  const tokens: Record<string, string> = {};
  for (const [role, email] of Object.entries(ROLES)) {
    const res = await login(email);
    tokens[role] = res.accessToken;
  }

  const sa = await loginAs("super_admin");
  const admin = await loginAs("admin");

  // Get stock variant for inventory tests
  const stockList = await api("GET", "/inventory/stock", admin.accessToken);
  const stockEntry = (stockList.data?.data || stockList.data || [])[0];
  const variantId = stockEntry?.variantId;

  // Get existing group/category for tests
  const groupList = await api("GET", "/client-groups", admin.accessToken);
  const groups = groupList.data?.data || groupList.data || [];
  const catList = await api("GET", "/catalog/categories", admin.accessToken);
  const categories = catList.data?.data || catList.data || [];

  const results: { endpoint: string; role: string; expected: string; actual: number; pass: boolean }[] = [];

  // Helper to create disposable test user for delete tests
  async function createTestUser(): Promise<string> {
    const res = await api("POST", "/users", sa.accessToken, {
      email: `qa-rbac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@maxmarket.com`,
      password: "ChangeMe1!",
      fullName: "RBAC Test User",
      role: "agent",
    });
    return res.data?.id;
  }

  // Helper to create disposable group
  async function createTestGroup(): Promise<string> {
    const res = await api("POST", "/client-groups", admin.accessToken, {
      name: `RBAC Group ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      discountType: "percentage",
      discountValue: 5,
    });
    return res.data?.id;
  }

  const MATRIX: RbacEntry[] = [
    {
      name: "POST /users",
      setup: async () => ({
        email: `qa-rbac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@maxmarket.com`,
        password: "ChangeMe1!",
        fullName: "RBAC Create Test",
        role: "agent",
      }),
      test: async (token, data) => api("POST", "/users", token, data),
      allowed: ["super_admin"],
      forbidden: ["admin", "manager", "agent", "client"],
    },
    {
      name: "PUT /users/{id}",
      setup: async () => {
        const id = await createTestUser();
        return { id, body: { fullName: "RBAC Edit Test" } };
      },
      test: async (token, data) => api("PUT", `/users/${data.id}`, token, data.body),
      allowed: ["super_admin"],
      forbidden: ["admin", "manager", "agent", "client"],
    },
    {
      name: "DELETE /users/{id}",
      setup: async () => {
        const id = await createTestUser();
        return { id };
      },
      test: async (token, data) => api("DELETE", `/users/${data.id}`, token),
      allowed: ["super_admin"],
      forbidden: ["admin", "manager", "agent", "client"],
    },
    {
      name: "POST /client-groups",
      setup: async () => ({
        name: `RBAC Group ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        discountType: "percentage",
        discountValue: 5,
      }),
      test: async (token, data) => api("POST", "/client-groups", token, data),
      allowed: ["super_admin", "admin"],
      forbidden: ["manager", "agent", "client"],
    },
    {
      name: "PUT /client-groups/{id}",
      setup: async () => {
        const id = await createTestGroup();
        return { id, body: { name: `Updated ${Date.now()}` } };
      },
      test: async (token, data) => api("PUT", `/client-groups/${data.id}`, token, data.body),
      allowed: ["super_admin", "admin"],
      forbidden: ["manager", "agent", "client"],
    },
    {
      name: "DELETE /client-groups/{id}",
      setup: async () => {
        const id = await createTestGroup();
        return { id };
      },
      test: async (token, data) => api("DELETE", `/client-groups/${data.id}`, token),
      allowed: ["super_admin", "admin"],
      forbidden: ["manager", "agent", "client"],
    },
    {
      name: "GET /client-groups",
      setup: async () => ({}),
      test: async (token) => api("GET", "/client-groups", token),
      allowed: ["super_admin", "admin", "manager", "agent"],
      forbidden: ["client"],
    },
    {
      name: "PUT /inventory/stock/adjust",
      setup: async () => ({
        warehouseId: WAREHOUSE_ID,
        variantId,
        newAvailableQty: stockEntry?.availableQty || 100,
        reason: "RBAC test",
      }),
      test: async (token, data) => api("PUT", "/inventory/stock/adjust", token, data),
      allowed: ["super_admin", "admin"],
      forbidden: ["manager", "agent", "client"],
    },
    {
      name: "GET /inventory/stock",
      setup: async () => ({}),
      test: async (token) => api("GET", "/inventory/stock", token),
      allowed: ["super_admin", "admin", "manager", "agent"],
      forbidden: ["client"],
    },
    {
      name: "POST /catalog/products",
      setup: async () => ({
        name: { en: `RBAC Product ${Date.now()}` },
        description: { en: "RBAC test" },
        categoryId: categories[0]?.id,
        variants: [{
          sku: `RBAC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          unitType: "piece",
          pricePerUnit: 10,
          costPrice: 5,
          minOrderQty: 1,
          isActive: true,
        }],
      }),
      test: async (token, data) => api("POST", "/catalog/products", token, data),
      allowed: ["super_admin", "admin"],
      forbidden: ["manager", "agent", "client"],
    },
    {
      name: "POST /catalog/categories",
      setup: async () => ({
        name: { en: `RBAC Cat ${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
      }),
      test: async (token, data) => api("POST", "/catalog/categories", token, data),
      allowed: ["super_admin", "admin"],
      forbidden: ["manager", "agent", "client"],
    },
  ];

  // Execute matrix
  for (const entry of MATRIX) {
    console.log(`\n  📋 ${entry.name}`);

    for (const role of entry.allowed) {
      const data = await entry.setup();
      const res = await entry.test(tokens[role], data);
      const pass = res.status >= 200 && res.status < 300;
      results.push({ endpoint: entry.name, role, expected: "2xx", actual: res.status, pass });
      console.log(pass
        ? `    ✅ ${role}: ${res.status} (allowed)`
        : `    ❌ ${role}: ${res.status} — expected 2xx ${res.data?.errorCode || ""}`
      );
    }

    for (const role of entry.forbidden) {
      let data: any;
      try { data = await entry.setup(); } catch { data = {}; }
      const res = await entry.test(tokens[role], data);
      const pass = res.status === 403;
      results.push({ endpoint: entry.name, role, expected: "403", actual: res.status, pass });
      console.log(pass
        ? `    ✅ ${role}: 403 (forbidden)`
        : `    ❌ ${role}: ${res.status} — expected 403 ${res.data?.errorCode || ""}`
      );
    }
  }

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  S9-9 RBAC Admin Matrix Summary`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}`);
  if (failed > 0) {
    console.log(`\n  Failures:`);
    results.filter(r => !r.pass).forEach(r => {
      console.log(`    - ${r.endpoint} as ${r.role}: expected ${r.expected}, got ${r.actual}`);
    });
  }
  console.log(`${"=".repeat(60)}\n`);

  return failed === 0;
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
