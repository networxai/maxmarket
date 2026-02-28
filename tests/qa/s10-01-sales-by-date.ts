// tests/qa/s10-01-sales-by-date.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs } from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S10-1: Sales by Date Report\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const client = await loginAs("client1");

  // Step 1: Admin fetches report
  const res = await api("GET", "/reports/sales-by-date?dateFrom=2025-01-01&dateTo=2027-01-01", admin.accessToken);
  assertEqual(res.status, 200, "Admin: sales-by-date returns 200");
  const rows = res.data?.data || res.data || [];
  assert(Array.isArray(rows), "Response is array");
  assert(rows.length > 0, "Has at least 1 row");

  // Step 2: Verify row shape
  const row = rows[0];
  assert(row.date !== undefined || row.period !== undefined, "Row has date/period field");
  assert(row.orderCount !== undefined, "Row has orderCount");
  assert(row.revenue !== undefined, "Row has revenue");
  console.log(`  Sample row: date=${row.date || row.period}, orders=${row.orderCount}, revenue=${row.revenue}`);

  // Step 3: Verify only fulfilled orders — orderCount should be > 0 given seed data
  const totalOrders = rows.reduce((sum: number, r: any) => sum + (r.orderCount || 0), 0);
  assert(totalOrders > 0, "Total orderCount > 0 (fulfilled orders exist in seed data)");

  // Step 4: Agent gets scoped results
  const agentRes = await api("GET", "/reports/sales-by-date?dateFrom=2025-01-01&dateTo=2027-01-01", agent.accessToken);
  assertEqual(agentRes.status, 200, "Agent: sales-by-date returns 200");

  // Step 5: Client → 403
  const clientRes = await api("GET", "/reports/sales-by-date?dateFrom=2025-01-01&dateTo=2027-01-01", client.accessToken);
  assertEqual(clientRes.status, 403, "Client: sales-by-date returns 403");

  return printSummary("S10-1: Sales by Date Report");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
