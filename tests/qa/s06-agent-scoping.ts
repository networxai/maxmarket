// tests/qa/s06-agent-scoping.ts
// S6: Agent Scoping

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, createDraft,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S6: Agent Scoping\n");

  const agent1 = await loginAs("agent1");
  const agent2 = await loginAs("agent2");
  const admin = await loginAs("admin");

  const variant = await getFirstVariant(agent1.accessToken);

  // Get client1 (agent1's) and client3 (agent2's)
  const agent1Clients = await getAgentClients(agent1.user.id, agent1.accessToken);
  const client1Id = agent1Clients[0].id || agent1Clients[0].clientId;

  // Find client3's ID via admin
  const usersRes = await api("GET", "/users?role=client", admin.accessToken);
  const allClients = usersRes.data?.data || usersRes.data || [];
  const client3 = allClients.find((u: any) =>
    u.email === "client3@maxmarket.com" || u.name?.includes("client3")
  );
  assert(!!client3, "Found client3 via admin user listing");
  const client3Id = client3?.id;

  // Step 1: Agent1 creates order for client1 (assigned) → 201
  const draft1 = await createDraft(agent1.accessToken, client1Id, variant.variantId, 3);
  assertEqual(draft1.status, 201, "Agent1 can create order for assigned client1");

  // Step 2: Agent1 creates order for client3 (agent2's client) → 403
  if (client3Id) {
    const forbidden = await createDraft(agent1.accessToken, client3Id, variant.variantId, 3);
    assertEqual(forbidden.status, 403, "Agent1 CANNOT create order for unassigned client3");
  }

  // Step 3: Agent2 creates draft for client3 → 201
  const agent2Clients = await getAgentClients(agent2.user.id, agent2.accessToken);
  const agent2ClientId = agent2Clients[0]?.id || agent2Clients[0]?.clientId || client3Id;
  const draft2 = await createDraft(agent2.accessToken, agent2ClientId, variant.variantId, 3);
  assertEqual(draft2.status, 201, "Agent2 can create order for assigned client3");
  const agent2OrderId = draft2.data.id;

  // Step 4: Agent1 cannot view agent2's order
  const viewForbidden = await api("GET", `/orders/${agent2OrderId}`, agent1.accessToken);
  assertEqual(viewForbidden.status, 403, "Agent1 CANNOT view agent2's order");

  // Step 5: Agent1's order list contains only their own orders
  const orderList = await api("GET", "/orders", agent1.accessToken);
  assertEqual(orderList.status, 200, "Agent1 can list orders");
  const orders = orderList.data?.data || orderList.data || [];
  const foreignOrders = orders.filter((o: any) =>
    o.agentId && o.agentId !== agent1.user.id
  );
  assertEqual(foreignOrders.length, 0, "Agent1 sees no orders from other agents");

  return printSummary("S6: Agent Scoping");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
