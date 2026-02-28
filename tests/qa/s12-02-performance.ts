// tests/qa/s12-02-performance.ts
import { loginAs, login, getFirstVariant, getAgentClients, WAREHOUSE_ID } from "./helpers.ts";

const API = "http://localhost:3000/api/v1";

async function benchmark(name: string, fn: () => Promise<any>, iterations = 10, thresholdMs = 500): Promise<{ name: string; avg: number; max: number; status: string }> {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fn();
    times.push(Date.now() - start);
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const max = Math.max(...times);
  const status = avg > 1000 ? "⚠️ SLOW" : avg > thresholdMs ? "WARN" : "OK";
  console.log(`  ${name}: avg=${avg}ms, max=${max}ms [${status}]`);
  return { name, avg, max, status };
}

async function main() {
  console.log("\n🔄 S12-02: Performance Baseline\n");

  const agent = await loginAs("agent1");
  const admin = await loginAs("admin");
  const variant = await getFirstVariant(agent.accessToken);
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0]?.id || clients[0]?.clientId;

  const results: any[] = [];

  // 1. POST /auth/login
  results.push(await benchmark("POST /auth/login", async () => {
    await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "agent1@maxmarket.com", password: "ChangeMe1!" }),
    });
  }, 10, 500));

  // 2. GET /catalog/products
  results.push(await benchmark("GET /catalog/products", async () => {
    await fetch(`${API}/catalog/products`, {
      headers: { Authorization: `Bearer ${agent.accessToken}` },
    });
  }, 10, 300));

  // 3. GET /orders
  results.push(await benchmark("GET /orders", async () => {
    await fetch(`${API}/orders`, {
      headers: { Authorization: `Bearer ${agent.accessToken}` },
    });
  }, 10, 300));

  // 4. POST /orders (create draft)
  results.push(await benchmark("POST /orders (create)", async () => {
    await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.accessToken}` },
      body: JSON.stringify({
        clientId,
        lineItems: [{ variantId: variant.variantId, qty: 1, warehouseId: WAREHOUSE_ID }],
      }),
    });
  }, 5, 500));

  // 5. GET /reports/sales-by-date
  results.push(await benchmark("GET /reports/sales-by-date", async () => {
    await fetch(`${API}/reports/sales-by-date?dateFrom=2025-01-01&dateTo=2027-01-01`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
  }, 5, 1000));

  // 6. GET /audit/logs
  results.push(await benchmark("GET /audit/logs", async () => {
    await fetch(`${API}/audit/logs`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
  }, 5, 500));

  // 7. GET /i18n/ui-strings
  results.push(await benchmark("GET /i18n/ui-strings", async () => {
    await fetch(`${API}/i18n/ui-strings?language=en`);
  }, 10, 200));

  // 8. GET /health
  results.push(await benchmark("GET /health", async () => {
    await fetch(`${API}/health`);
  }, 10, 100));

  // Summary
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  Performance Baseline Summary`);
  console.log(`${"=".repeat(70)}`);
  console.log(`  ${"Endpoint".padEnd(35)} ${"Avg".padStart(8)} ${"Max".padStart(8)}  Status`);
  console.log(`  ${"-".repeat(65)}`);
  for (const r of results) {
    console.log(`  ${r.name.padEnd(35)} ${(r.avg + "ms").padStart(8)} ${(r.max + "ms").padStart(8)}  ${r.status}`);
  }
  console.log(`${"=".repeat(70)}\n`);

  const slow = results.filter(r => r.status === "⚠️ SLOW");
  if (slow.length > 0) {
    console.log(`  ⚠️ ${slow.length} endpoint(s) averaging over 1 second — needs optimization`);
  } else {
    console.log(`  ✅ All endpoints within acceptable thresholds`);
  }
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
