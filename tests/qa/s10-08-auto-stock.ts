// tests/qa/s10-08-auto-stock.ts
import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getAgentClients, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S10-8: Auto-Stock on Variant Creation (DL-17)\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");

  // Get a category
  const catList = await api("GET", "/catalog/categories", admin.accessToken);
  const categories = catList.data?.data || catList.data || [];
  const categoryId = categories[0]?.id;

  // Step 1: Create product with variant
  const sku = `DL17-${Date.now()}`;
  const create = await api("POST", "/catalog/products", admin.accessToken, {
    name: { en: `DL-17 Test Product ${Date.now()}` },
    description: { en: "Auto-stock test" },
    categoryId,
    variants: [{
      sku,
      unitType: "piece",
      pricePerUnit: 20,
      costPrice: 8,
      minOrderQty: 1,
      isActive: true,
    }],
  });
  assertEqual(create.status, 201, "Product with variant created");
  const variantId = create.data?.variants?.[0]?.id;
  assert(!!variantId, "Variant has id");

  // Step 2: Check stock row exists automatically
  const stockCheck = await api("GET", `/inventory/stock?variantId=${variantId}`, admin.accessToken);
  assertEqual(stockCheck.status, 200, "Stock query returns 200");
  const stockRows = stockCheck.data?.data || stockCheck.data || [];
  assert(stockRows.length > 0, "Stock row auto-created for new variant (DL-17)");

  if (stockRows.length > 0) {
    const stock = stockRows[0];
    assertEqual(stock.availableQty, 0, "Initial availableQty is 0");
    assertEqual(stock.reservedQty, 0, "Initial reservedQty is 0");
  }

  // Step 3: Adjust stock to 50
  const adjust = await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId,
    newAvailableQty: 50,
    reason: "DL-17 test setup",
  });
  assertEqual(adjust.status, 200, "Stock adjusted to 50");

  // Step 4: Create order → submit → approve
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0]?.id || clients[0]?.clientId;

  const draft = await api("POST", "/orders", agent.accessToken, {
    clientId,
    lineItems: [{ variantId, qty: 5, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(draft.status, 201, "Order created with new variant");

  const submit = await api("POST", `/orders/${draft.data.id}/submit`, agent.accessToken);
  assertEqual(submit.status, 200, "Order submitted");

  const approve = await api("POST", `/orders/${draft.data.id}/approve`, manager.accessToken, {
    versionLock: submit.data.versionLock,
  });
  assertEqual(approve.status, 200, "Order approved (stock was available)");

  return printSummary("S10-8: Auto-Stock on Variant Creation (DL-17)");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
