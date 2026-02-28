// tests/qa/s9-04-inventory-adjust.ts
// S9-4: Inventory Stock Adjust

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getStock, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-4: Inventory Stock Adjust\n");

  const admin = await loginAs("admin");

  // Step 1: Get stock, pick a variant
  const stockList = await api("GET", "/inventory/stock", admin.accessToken);
  assertEqual(stockList.status, 200, "Admin can GET /inventory/stock");
  const allStock = stockList.data?.data || stockList.data || [];
  assert(allStock.length > 0, "Stock entries exist");

  const target = allStock.find((s: any) => s.sku === "HH-SOAP-1") || allStock[0];
  const variantId = target.variantId;
  const origAvailable = target.availableQty;
  const origReserved = target.reservedQty;
  console.log(`  Using: ${target.sku}, available=${origAvailable}, reserved=${origReserved}`);

  // Step 2: Adjust stock — increase by 50
  const newQty = origAvailable + 50;
  const adjust = await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId,
    newAvailableQty: newQty,
    reason: "QA restock test",
  });
  assertEqual(adjust.status, 200, "Stock adjust returns 200");

  // Step 3: Verify new value
  const afterAdjust = await getStock(variantId, admin.accessToken);
  assertEqual(afterAdjust.availableQty, newQty, "Available qty updated to new value");

  // Step 4: Try to set below reserved → STOCK_BELOW_RESERVED
  const belowReserved = await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId,
    newAvailableQty: origReserved - 1,
    reason: "QA test — should fail",
  });
  assertEqual(belowReserved.status, 422, "Setting below reserved returns 422");
  assertEqual(belowReserved.data?.errorCode, "STOCK_BELOW_RESERVED", "Error code is STOCK_BELOW_RESERVED");

  // Step 5: Agent cannot adjust stock
  const agent = await loginAs("agent1");
  const agentAdjust = await api("PUT", "/inventory/stock/adjust", agent.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId,
    newAvailableQty: 999,
    reason: "Agent attempt",
  });
  assertEqual(agentAdjust.status, 403, "Agent cannot adjust stock (403)");

  // Step 6: Manager cannot adjust stock
  const manager = await loginAs("manager");
  const managerAdjust = await api("PUT", "/inventory/stock/adjust", manager.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId,
    newAvailableQty: 999,
    reason: "Manager attempt",
  });
  assertEqual(managerAdjust.status, 403, "Manager cannot adjust stock (403)");

  // Step 7: Agent CAN view stock
  const agentView = await api("GET", "/inventory/stock", agent.accessToken);
  assertEqual(agentView.status, 200, "Agent can view stock (200)");

  // Step 8: Client cannot view stock
  const client = await loginAs("client1");
  const clientView = await api("GET", "/inventory/stock", client.accessToken);
  assertEqual(clientView.status, 403, "Client cannot view stock (403)");

  // Restore stock
  await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId,
    newAvailableQty: origAvailable,
    reason: "QA test cleanup",
  });

  return printSummary("S9-4: Inventory Stock Adjust");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
