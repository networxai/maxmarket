// tests/qa/s10-02-sales-by-manager.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs } from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S10-2: Sales by Manager Report\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const client = await loginAs("client1");

  // Step 1: Admin fetches report
  const res = await api("GET", "/reports/sales-by-manager", admin.accessToken);
  assertEqual(res.status, 200, "Admin: sales-by-manager returns 200");
  const rows = res.data?.data || res.data || [];
  assert(Array.isArray(rows), "Response is array");

  // Step 2: Verify row shape
  if (rows.length > 0) {
    const row = rows[0];
    assert(row.agentId !== undefined || row.managerId !== undefined, "Row has agentId/managerId");
    assert(row.agentName !== undefined || row.managerName !== undefined, "Row has agentName/managerName");
    assert(row.orderCount !== undefined, "Row has orderCount");
    assert(row.revenue !== undefined, "Row has revenue");
    console.log(`  Sample: agent=${row.agentName || row.managerName}, orders=${row.orderCount}, revenue=${row.revenue}`);
  } else {
    console.log("  ℹ️  No manager rows (no fulfilled orders with manager attribution)");
  }

  // Step 3: Agent → 403
  const agentRes = await api("GET", "/reports/sales-by-manager", agent.accessToken);
  assertEqual(agentRes.status, 403, "Agent: sales-by-manager returns 403");

  // Step 4: Client → 403
  const clientRes = await api("GET", "/reports/sales-by-manager", client.accessToken);
  assertEqual(clientRes.status, 403, "Client: sales-by-manager returns 403");

  return printSummary("S10-2: Sales by Manager Report");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
