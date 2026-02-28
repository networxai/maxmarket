// tests/qa/s11-07-regression.ts
import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, WAREHOUSE_ID,
} from "./helpers.ts";

const API = "http://localhost:3000/api/v1";

async function main() {
  resetCounters();
  console.log("\n🔄 S11-7: Phase 10 Regression\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");

  // Step 1: Sales report
  const sales = await api("GET", "/reports/sales-by-date?dateFrom=2025-01-01&dateTo=2027-01-01", admin.accessToken);
  assertEqual(sales.status, 200, "Sales-by-date returns 200");
  const rows = sales.data?.data || sales.data || [];
  assert(rows.length > 0, "Sales report has data");

  // Step 2: CSV export
  const csvRes = await fetch(`${API}/reports/sales-by-date/export?format=csv&dateFrom=2025-01-01&dateTo=2027-01-01`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  assertEqual(csvRes.status, 200, "CSV export returns 200");
  const csvBody = await csvRes.text();
  assert(csvBody.includes(","), "CSV body contains data");

  // Step 3: Audit logs
  const audit = await api("GET", "/audit/logs", admin.accessToken);
  assertEqual(audit.status, 200, "Audit logs returns 200");
  const logs = audit.data?.data || audit.data || [];
  assert(logs.length > 0, "Audit logs have entries");

  // Step 4: Order lifecycle
  const variant = await getFirstVariant(agent.accessToken);
  await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId: variant.variantId,
    newAvailableQty: 1000,
    reason: "S11-7 regression stock",
  });

  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0]?.id || clients[0]?.clientId;

  const draft = await api("POST", "/orders", agent.accessToken, {
    clientId,
    lineItems: [{ variantId: variant.variantId, qty: 1, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(draft.status, 201, "Agent creates draft successfully");

  return printSummary("S11-7: Phase 10 Regression");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
