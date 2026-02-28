// tests/qa/s10-09-rbac-reports-audit.ts
import { api, assert, login, resetCounters, loginAs, WAREHOUSE_ID } from "./helpers.ts";

const ROLES: Record<string, string> = {
  super_admin: "super_admin@maxmarket.com",
  admin: "admin1@maxmarket.com",
  manager: "manager1@maxmarket.com",
  agent: "agent1@maxmarket.com",
  client: "client1@maxmarket.com",
};

const API_BASE = "http://localhost:3000/api/v1";

async function main() {
  resetCounters();
  console.log("\n🔄 S10-9: RBAC Reports & Audit Matrix\n");

  const tokens: Record<string, string> = {};
  for (const [role, email] of Object.entries(ROLES)) {
    const res = await login(email);
    tokens[role] = res.accessToken;
  }

  const dateParams = "dateFrom=2025-01-01&dateTo=2027-01-01";

  const MATRIX: {
    name: string;
    path: string;
    method?: string;
    body?: any;
    allowed: string[];
    forbidden: string[];
  }[] = [
    {
      name: "GET sales-by-date",
      path: `/reports/sales-by-date?${dateParams}`,
      allowed: ["super_admin", "admin", "manager", "agent"],
      forbidden: ["client"],
    },
    {
      name: "GET sales-by-manager",
      path: "/reports/sales-by-manager",
      allowed: ["super_admin", "admin", "manager"],
      forbidden: ["agent", "client"],
    },
    {
      name: "GET sales-by-client",
      path: "/reports/sales-by-client",
      allowed: ["super_admin", "admin", "manager", "agent"],
      forbidden: ["client"],
    },
    {
      name: "GET sales-by-product",
      path: "/reports/sales-by-product",
      allowed: ["super_admin", "admin", "manager", "agent"],
      forbidden: ["client"],
    },
    {
      name: "GET export CSV",
      path: `/reports/sales-by-date/export?format=csv&${dateParams}`,
      allowed: ["super_admin", "admin", "manager", "agent"],
      forbidden: ["client"],
    },
    {
      name: "GET audit/logs",
      path: "/audit/logs",
      allowed: ["super_admin", "admin"],
      forbidden: ["manager", "agent", "client"],
    },
    {
      name: "POST audit/logs/clear",
      path: "/audit/logs/clear",
      method: "POST",
      body: { scope: "before_date", beforeDate: "2020-01-01T00:00:00Z" },
      allowed: ["super_admin"],
      forbidden: ["admin", "manager", "agent", "client"],
    },
  ];

  const results: { endpoint: string; role: string; expected: string; actual: number; pass: boolean }[] = [];

  for (const entry of MATRIX) {
    console.log(`\n  📋 ${entry.name}`);
    const method = entry.method || "GET";

    for (const role of entry.allowed) {
      const res = await api(method, entry.path, tokens[role], entry.body);
      const pass = res.status >= 200 && res.status < 300;
      results.push({ endpoint: entry.name, role, expected: "2xx", actual: res.status, pass });
      console.log(pass
        ? `    ✅ ${role}: ${res.status} (allowed)`
        : `    ❌ ${role}: ${res.status} — expected 2xx ${res.data?.errorCode || ""}`
      );
    }

    for (const role of entry.forbidden) {
      const res = await api(method, entry.path, tokens[role], entry.body);
      const pass = res.status === 403;
      results.push({ endpoint: entry.name, role, expected: "403", actual: res.status, pass });
      console.log(pass
        ? `    ✅ ${role}: 403 (forbidden)`
        : `    ❌ ${role}: ${res.status} — expected 403 ${res.data?.errorCode || ""}`
      );
    }
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  S10-9 RBAC Reports & Audit Matrix`);
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

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
