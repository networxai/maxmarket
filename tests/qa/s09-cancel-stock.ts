// tests/qa/s09-cancel-stock.ts
// S9: Cancel Releases Reserved Stock

import {
  api, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, createApprovedOrder, getStock,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9: Cancel Releases Reserved Stock\n");

  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");

  const variant = await getFirstVariant(agent.accessToken);
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  const orderQty = 6;

  // Step 1: Create and approve
  const approved = await createApprovedOrder(
    agent.accessToken, manager.accessToken, clientId, variant.variantId, orderQty
  );
  const orderId = approved.id;
  assertEqual(approved.status, "approved", "Order is approved");

  // Step 2: Record stock
  const stockBefore = await getStock(variant.variantId, manager.accessToken);
  console.log(`  Stock after approve: available=${stockBefore.availableQty}, reserved=${stockBefore.reservedQty}`);

  // Step 3: Cancel
  const cancel = await api("POST", `/orders/${orderId}/cancel`, manager.accessToken);
  assertEqual(cancel.status, 200, "Cancel returns 200");
  assertEqual(cancel.data?.status, "cancelled", "Status is 'cancelled'");

  // Step 4: Check stock
  const stockAfter = await getStock(variant.variantId, manager.accessToken);
  assertEqual(
    stockAfter.reservedQty,
    stockBefore.reservedQty - orderQty,
    "Reserved qty decreased by order qty after cancel"
  );
  assertEqual(
    stockAfter.availableQty,
    stockBefore.availableQty,
    "Available qty unchanged after cancel"
  );

  return printSummary("S9: Cancel Releases Reserved Stock");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
