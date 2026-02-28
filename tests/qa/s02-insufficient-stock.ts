// tests/qa/s02-insufficient-stock.ts
// S2: Insufficient Stock — stock checked at approve time, not draft creation

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getAgentClients, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S2: Insufficient Stock\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");

  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  // Pick a variant from stock listing
  const stockList = await api("GET", "/inventory/stock", admin.accessToken);
  const allStock = stockList.data?.data || stockList.data || [];
  const targetStock = allStock.find((s: any) => s.sku === "HH-SOAP-1") || allStock[0];
  const variantId = targetStock.variantId;
  console.log(`  Using variant: ${targetStock.sku} (${variantId})`);
  console.log(`  Current stock: available=${targetStock.availableQty}, reserved=${targetStock.reservedQty}`);

  // Step 1: Admin adjusts stock so free qty is very small (free = 2)
  const tightAvailable = targetStock.reservedQty + 2;
  const adjust1 = await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId,
    newAvailableQty: tightAvailable,
    reason: "QA test setup — S2 insufficient stock",
  });
  assertEqual(adjust1.status, 200, "Stock adjusted to tight level");

  // Step 2: Verify stock
  const stockAfterAdjust = await api("GET", `/inventory/stock?variantId=${variantId}`, admin.accessToken);
  const currentStock = stockAfterAdjust.data?.data?.[0] || stockAfterAdjust.data?.[0];
  const free = currentStock.availableQty - currentStock.reservedQty;
  console.log(`  Stock after adjust: available=${currentStock.availableQty}, reserved=${currentStock.reservedQty}, free=${free}`);
  assert(free <= 2, "Free stock is small (<=2)", { free });

  // Step 3: Agent creates draft with qty much larger than free, then submits
  const overQty = free + 50;
  console.log(`  Creating order with qty=${overQty} (free=${free})`);

  const draft = await api("POST", "/orders", agent.accessToken, {
    clientId,
    lineItems: [{ variantId, qty: overQty, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(draft.status, 201, "Draft with oversize qty created (stock not checked at draft)");
  const orderId = draft.data.id;

  const submit = await api("POST", `/orders/${orderId}/submit`, agent.accessToken);
  assertEqual(submit.status, 200, "Submit succeeds (stock not checked until approve)");

  // Step 4: Manager approves → should fail with INSUFFICIENT_STOCK
  const approve = await api("POST", `/orders/${orderId}/approve`, manager.accessToken, {
    versionLock: submit.data.versionLock,
  });
  assertEqual(approve.status, 422, "Approve returns 422 for insufficient stock");
  assertEqual(approve.data?.errorCode, "INSUFFICIENT_STOCK", "Error code is INSUFFICIENT_STOCK");

  const details = approve.data?.details;
  assert(Array.isArray(details) && details.length > 0, "Details array is present and non-empty", details);
  if (details?.[0]) {
    console.log("  Details[0]:", JSON.stringify(details[0], null, 2));
    const d = details[0];
    assert(d.lineItemId !== undefined || d.line_item_id !== undefined, "Details includes lineItemId");
    assert(d.variantId !== undefined || d.variant_id !== undefined, "Details includes variantId");
    assert(d.sku !== undefined, "Details includes sku");
    assert(d.requestedQty !== undefined || d.requested_qty !== undefined, "Details includes requestedQty");
    assert(d.availableQty !== undefined || d.available_qty !== undefined, "Details includes availableQty");
    assert(d.reservedQty !== undefined || d.reserved_qty !== undefined, "Details includes reservedQty");
  }

  // Step 5: Verify order status unchanged
  const refetch = await api("GET", `/orders/${orderId}`, manager.accessToken);
  assertEqual(refetch.data?.status, "submitted", "Order still 'submitted' after failed approve");

  // Step 6: Restore stock
  const restore = await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId,
    newAvailableQty: 100,
    reason: "QA test cleanup — S2 restore",
  });
  assertEqual(restore.status, 200, "Stock restored");

  return printSummary("S2: Insufficient Stock");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
