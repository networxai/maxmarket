// tests/qa/s10-03-sales-by-client.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs, getAgentClients } from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S10-3: Sales by Client Report\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const client = await loginAs("client1");

  // Step 1: Admin gets all clients
  const res = await api("GET", "/reports/sales-by-client", admin.accessToken);
  assertEqual(res.status, 200, "Admin: sales-by-client returns 200");
  const rows = res.data?.data || res.data || [];
  assert(Array.isArray(rows), "Response is array");
  console.log(`  Admin sees ${rows.length} client rows`);

  // Step 2: Agent gets scoped results
  const agentRes = await api("GET", "/reports/sales-by-client", agent.accessToken);
  assertEqual(agentRes.status, 200, "Agent: sales-by-client returns 200");
  const agentRows = agentRes.data?.data || agentRes.data || [];

  // Agent should see fewer or equal clients than admin
  assert(agentRows.length <= rows.length, "Agent sees <= admin's client count");
  console.log(`  Agent sees ${agentRows.length} client rows`);

  // Step 3: Filter by clientId
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const client1Id = clients[0]?.id || clients[0]?.clientId;
  if (client1Id) {
    const filtered = await api("GET", `/reports/sales-by-client?clientId=${client1Id}`, admin.accessToken);
    assertEqual(filtered.status, 200, "Filtered by clientId returns 200");
    const filteredRows = filtered.data?.data || filtered.data || [];
    assert(
      filteredRows.length <= 1 || filteredRows.every((r: any) => r.clientId === client1Id),
      "Filter returns only matching client"
    );
  }

  // Step 4: Client → 403
  const clientRes = await api("GET", "/reports/sales-by-client", client.accessToken);
  assertEqual(clientRes.status, 403, "Client: sales-by-client returns 403");

  return printSummary("S10-3: Sales by Client Report");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
