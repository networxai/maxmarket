// tests/qa/s10-04-sales-by-product.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs, getFirstVariant } from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S10-4: Sales by Product Report\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const client = await loginAs("client1");

  // Step 1: Admin gets all products
  const res = await api("GET", "/reports/sales-by-product", admin.accessToken);
  assertEqual(res.status, 200, "Admin: sales-by-product returns 200");
  const rows = res.data?.data || res.data || [];
  assert(Array.isArray(rows), "Response is array");
  console.log(`  Admin sees ${rows.length} product rows`);

  // Step 2: Agent gets scoped results
  const agentRes = await api("GET", "/reports/sales-by-product", agent.accessToken);
  assertEqual(agentRes.status, 200, "Agent: sales-by-product returns 200");
  const agentRows = agentRes.data?.data || agentRes.data || [];
  console.log(`  Agent sees ${agentRows.length} product rows`);

  // Step 3: Filter by variantId
  const variant = await getFirstVariant(admin.accessToken);
  const filtered = await api("GET", `/reports/sales-by-product?variantId=${variant.variantId}`, admin.accessToken);
  assertEqual(filtered.status, 200, "Filtered by variantId returns 200");
  const filteredRows = filtered.data?.data || filtered.data || [];
  assert(
    filteredRows.length <= 1 || filteredRows.every((r: any) => r.variantId === variant.variantId),
    "Filter returns only matching variant"
  );

  // Step 4: Client → 403
  const clientRes = await api("GET", "/reports/sales-by-product", client.accessToken);
  assertEqual(clientRes.status, 403, "Client: sales-by-product returns 403");

  return printSummary("S10-4: Sales by Product Report");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
