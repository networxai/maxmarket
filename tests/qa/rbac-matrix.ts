// tests/qa/rbac-matrix.ts
// QA8.3: RBAC Matrix — Test every order endpoint as every role

import {
  api, login, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, createDraft, WAREHOUSE_ID,
} from "./helpers.ts";

interface MatrixEntry {
  name: string;
  setup: () => Promise<any>;
  test: (token: string, data: any) => Promise<{ status: number; data: any; correlationId: string }>;
  allowed: string[];
  forbidden: string[];
}

const ROLES: Record<string, string> = {
  super_admin: "super_admin@maxmarket.com",
  admin: "admin1@maxmarket.com",
  manager: "manager1@maxmarket.com",
  agent: "agent1@maxmarket.com",
  client: "client1@maxmarket.com",
};

async function main() {
  resetCounters();
  console.log("\n🔄 QA8.3: RBAC Matrix\n");

  // Pre-login all roles
  const tokens: Record<string, string> = {};
  const users: Record<string, any> = {};
  for (const [role, email] of Object.entries(ROLES)) {
    const res = await login(email);
    tokens[role] = res.accessToken;
    users[role] = res.user;
  }

  const agent1 = await loginAs("agent1");
  const manager = await loginAs("manager");
  const admin = await loginAs("admin");
  const clients = await getAgentClients(agent1.user.id, agent1.accessToken);
  const clientId = clients[0]?.id || clients[0]?.clientId;

  // Pick a variant with lots of free stock, or reset stock first
  const stockList = await api("GET", "/inventory/stock", admin.accessToken);
  const allStock = (stockList.data?.data || stockList.data || []) as any[];
  // Sort by free qty descending, pick the one with most room
  allStock.sort((a: any, b: any) => (b.availableQty - b.reservedQty) - (a.availableQty - a.reservedQty));
  const bestStock = allStock[0];

  // Reset stock to 1000 to ensure we have plenty for the matrix
  await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId: bestStock.variantId,
    newAvailableQty: 1000,
    reason: "QA RBAC matrix — ensure sufficient stock",
  });

  // We need to find this variant in the catalog to use it
  const variantId = bestStock.variantId;
  console.log(`  Using variant: ${bestStock.sku} (${variantId}), reset to 1000 available\n`);

  // Helper: create a submitted order for testing
  async function createSubmittedOrder(): Promise<{ orderId: string; versionLock: number; lineItemId: string }> {
    const draft = await createDraft(agent1.accessToken, clientId, variantId, 1);
    if (draft.status !== 201) throw new Error(`Draft failed: ${draft.status} ${JSON.stringify(draft.data)}`);
    const orderId = draft.data.id;
    const submit = await api("POST", `/orders/${orderId}/submit`, agent1.accessToken);
    if (submit.status !== 200) throw new Error(`Submit failed: ${submit.status} ${JSON.stringify(submit.data)}`);
    return {
      orderId,
      versionLock: submit.data.versionLock,
      lineItemId: submit.data.lineItems?.[0]?.id || submit.data.lineItems?.[0]?.lineItemId,
    };
  }

  // Helper: create an approved order
  async function createApproved(): Promise<{ orderId: string; versionLock: number }> {
    const { orderId, versionLock } = await createSubmittedOrder();
    const app = await api("POST", `/orders/${orderId}/approve`, manager.accessToken, { versionLock });
    if (app.status !== 200) throw new Error(`Approve failed: ${app.status} ${JSON.stringify(app.data)}`);
    return { orderId, versionLock: app.data.versionLock };
  }

  // Helper: create a fulfilled order
  async function createFulfilled(): Promise<string> {
    const { orderId } = await createApproved();
    const f = await api("POST", `/orders/${orderId}/fulfill`, manager.accessToken);
    if (f.status !== 200) throw new Error(`Fulfill failed: ${f.status} ${JSON.stringify(f.data)}`);
    return orderId;
  }

  const results: { endpoint: string; role: string; expected: string; actual: number; pass: boolean; correlationId: string }[] = [];

  const MATRIX: MatrixEntry[] = [
    {
      name: "POST /orders (create draft)",
      setup: async () => ({ clientId, lineItems: [{ variantId: variantId, qty: 1, warehouseId: WAREHOUSE_ID }] }),
      test: async (token, data) => api("POST", "/orders", token, data),
      allowed: ["agent"],
      forbidden: ["super_admin", "admin", "manager", "client"],
    },
    {
      name: "GET /orders (list)",
      setup: async () => ({}),
      test: async (token) => api("GET", "/orders", token),
      allowed: ["super_admin", "admin", "manager", "agent", "client"],
      forbidden: [],
    },
    {
      name: "POST /orders/{id}/submit",
      setup: async () => {
        const draft = await createDraft(agent1.accessToken, clientId, variantId, 1);
        return { orderId: draft.data.id };
      },
      test: async (token, data) => api("POST", `/orders/${data.orderId}/submit`, token),
      allowed: ["agent"],
      forbidden: ["super_admin", "admin", "manager", "client"],
    },
    {
      name: "POST /orders/{id}/approve",
      setup: async () => {
        const s = await createSubmittedOrder();
        return s;
      },
      test: async (token, data) => api("POST", `/orders/${data.orderId}/approve`, token, { versionLock: data.versionLock }),
      allowed: ["manager"],
      forbidden: ["super_admin", "admin", "agent", "client"],
    },
    {
      name: "POST /orders/{id}/reject",
      setup: async () => {
        const s = await createSubmittedOrder();
        return s;
      },
      test: async (token, data) => api("POST", `/orders/${data.orderId}/reject`, token, { reason: "RBAC test", versionLock: data.versionLock }),
      allowed: ["manager"],
      forbidden: ["super_admin", "admin", "agent", "client"],
    },
    {
      name: "POST /orders/{id}/fulfill",
      setup: async () => {
        const a = await createApproved();
        return a;
      },
      test: async (token, data) => api("POST", `/orders/${data.orderId}/fulfill`, token),
      allowed: ["manager"],
      forbidden: ["super_admin", "admin", "agent", "client"],
    },
    {
      name: "POST /orders/{id}/cancel",
      setup: async () => {
        const a = await createApproved();
        return { orderId: a.orderId };
      },
      test: async (token, data) => api("POST", `/orders/${data.orderId}/cancel`, token),
      allowed: ["manager", "super_admin", "admin"],
      forbidden: ["agent", "client"],
    },
    {
      name: "POST /orders/{id}/return",
      setup: async () => {
        try {
          const orderId = await createFulfilled();
          return { orderId };
        } catch (e) {
          console.error("      ⚠️ createFulfilled failed:", (e as Error).message);
          return { orderId: "setup-failed" };
        }
      },
      test: async (token, data) => api("POST", `/orders/${data.orderId}/return`, token),
      allowed: ["manager", "super_admin", "admin"],
      forbidden: ["agent", "client"],
    },
    {
      name: "DELETE /orders/{id} (draft)",
      setup: async () => {
        const draft = await createDraft(agent1.accessToken, clientId, variantId, 1);
        return { orderId: draft.data.id };
      },
      test: async (token, data) => api("DELETE", `/orders/${data.orderId}`, token),
      allowed: ["agent"],
      forbidden: ["super_admin", "admin", "manager", "client"],
    },
    {
      name: "POST /orders/{id}/line-items/{lineItemId}/override-price",
      setup: async () => {
        const s = await createSubmittedOrder();
        return s;
      },
      test: async (token, data) => api("POST", `/orders/${data.orderId}/line-items/${data.lineItemId}/override-price`, token, { managerOverride: 50.0 }),
      allowed: ["manager"],
      forbidden: ["super_admin", "admin", "agent", "client"],
    },
  ];

  // Execute matrix
  for (const entry of MATRIX) {
    console.log(`\n  📋 ${entry.name}`);

    // Test allowed roles
    for (const role of entry.allowed) {
      const data = await entry.setup();
      const res = await entry.test(tokens[role], data);
      const pass = res.status >= 200 && res.status < 300;
      results.push({ endpoint: entry.name, role, expected: "2xx", actual: res.status, pass, correlationId: res.correlationId });
      if (pass) {
        console.log(`    ✅ ${role}: ${res.status} (allowed)`);
      } else {
        console.error(`    ❌ ${role}: ${res.status} — expected 2xx`, res.data?.errorCode || "");
      }
    }

    // Test forbidden roles
    for (const role of entry.forbidden) {
      let data: any;
      try {
        data = await entry.setup();
      } catch {
        data = {};
      }
      const res = await entry.test(tokens[role], data);
      const pass = res.status === 403;
      results.push({ endpoint: entry.name, role, expected: "403", actual: res.status, pass, correlationId: res.correlationId });
      if (pass) {
        console.log(`    ✅ ${role}: 403 (forbidden)`);
      } else {
        console.error(`    ❌ ${role}: ${res.status} — expected 403`, res.data?.errorCode || "");
      }
    }
  }

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  RBAC Matrix Summary`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}`);

  if (failed > 0) {
    console.log(`\n  Failures:`);
    results.filter(r => !r.pass).forEach(r => {
      console.log(`    - ${r.endpoint} as ${r.role}: expected ${r.expected}, got ${r.actual} [${r.correlationId}]`);
    });
  }
  console.log(`${"=".repeat(60)}\n`);

  return failed === 0;
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
