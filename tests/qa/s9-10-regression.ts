// tests/qa/s9-10-regression.ts
// S9-10: Phase 8 Regression

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, assertAbsentOrNull,
  createDraft, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-10: Phase 8 Regression\n");

  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");
  const client1 = await loginAs("client1");
  const admin = await loginAs("admin");

  const variant = await getFirstVariant(agent.accessToken);
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  // Ensure stock
  await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId: variant.variantId,
    newAvailableQty: 1000,
    reason: "S9-10 regression stock setup",
  });

  // Step 1: Agent creates → submits
  const draft = await createDraft(agent.accessToken, clientId, variant.variantId, 3);
  assertEqual(draft.status, 201, "Agent creates draft");

  const submit = await api("POST", `/orders/${draft.data.id}/submit`, agent.accessToken);
  assertEqual(submit.status, 200, "Agent submits order");

  // Step 2: Manager approves
  const approve = await api("POST", `/orders/${draft.data.id}/approve`, manager.accessToken, {
    versionLock: submit.data.versionLock,
  });
  assertEqual(approve.status, 200, "Manager approves order");

  // Step 3: Client views orders — read-only, no sensitive data
  const orderList = await api("GET", "/orders", client1.accessToken);
  assertEqual(orderList.status, 200, "Client can list orders");

  const orders = orderList.data?.data || orderList.data || [];
  assert(orders.length > 0, "Client has orders");

  const order = orders[0];
  const detail = await api("GET", `/orders/${order.id}`, client1.accessToken);
  assertEqual(detail.status, 200, "Client can view order detail");

  assertAbsentOrNull(detail.data, "agentId", "No agentId visible to client");

  const lineItem = detail.data?.lineItems?.[0];
  if (lineItem) {
    assertAbsentOrNull(lineItem, "groupDiscount", "No groupDiscount visible to client");
    assertAbsentOrNull(lineItem, "basePrice", "No basePrice visible to client");
    assert(lineItem.finalPrice !== undefined, "finalPrice is visible to client");
  }

  // Verify client cannot mutate
  const mutate = await api("POST", `/orders/${order.id}/cancel`, client1.accessToken);
  assertEqual(mutate.status, 403, "Client cannot cancel orders (403)");

  return printSummary("S9-10: Phase 8 Regression");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
