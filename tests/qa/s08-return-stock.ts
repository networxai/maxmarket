// tests/qa/s08-return-stock.ts
// S8: Return Does Not Restore Stock (CTO-DEC-001, DL-10)

import {
  api, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, createFulfilledOrder, getStock,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S8: Return Does Not Restore Stock\n");

  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");

  const variant = await getFirstVariant(agent.accessToken);
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  // Step 1: Create a fulfilled order
  const fulfilled = await createFulfilledOrder(
    agent.accessToken, manager.accessToken, clientId, variant.variantId, 4
  );
  const orderId = fulfilled.id;
  assertEqual(fulfilled.status, "fulfilled", "Order is fulfilled");

  // Step 2: Record stock
  const stockBefore = await getStock(variant.variantId, manager.accessToken);
  console.log(`  Stock before return: available=${stockBefore.availableQty}, reserved=${stockBefore.reservedQty}`);

  // Step 3: Return the order
  const returnRes = await api("POST", `/orders/${orderId}/return`, manager.accessToken);
  assertEqual(returnRes.status, 200, "Return returns 200");
  assertEqual(returnRes.data?.status, "returned", "Status is 'returned'");

  // Step 4: Stock unchanged
  const stockAfter = await getStock(variant.variantId, manager.accessToken);
  assertEqual(stockAfter.availableQty, stockBefore.availableQty, "Available qty unchanged after return");
  assertEqual(stockAfter.reservedQty, stockBefore.reservedQty, "Reserved qty unchanged after return");

  return printSummary("S8: Return Does Not Restore Stock");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
