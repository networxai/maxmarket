// tests/qa/s01-order-lifecycle.ts
// S1: Full Order Lifecycle (Happy Path)

import {
  login, api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, getStock, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S1: Full Order Lifecycle (Happy Path)\n");

  // Step 1: Login as agent1
  const agent = await loginAs("agent1");
  assert(!!agent.accessToken, "Agent1 login successful");

  // Step 2: Get agent1's clients → pick client1
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  assert(clients.length > 0, "Agent1 has assigned clients");
  const client1 = clients[0];
  const clientId = client1.id || client1.clientId;
  assert(!!clientId, "Client1 ID retrieved");

  // Step 3: Get catalog → pick a variant
  const variant = await getFirstVariant(agent.accessToken);
  assert(!!variant.variantId, "Found a product variant in catalog");
  console.log(`  Using variant: ${variant.variantId}, price: ${variant.pricePerUnit}`);

  // Step 4: Create draft — qty=5
  const draft = await api("POST", "/orders", agent.accessToken, {
    clientId,
    lineItems: [{ variantId: variant.variantId, qty: 5, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(draft.status, 201, "Draft creation returns 201");
  assertEqual(draft.data.status, "draft", "Order status is 'draft'");
  assert(
    /^MM-\d{4}-\d{6}$/.test(draft.data.orderNumber),
    "Order number matches MM-YYYY-NNNNNN pattern",
    { orderNumber: draft.data.orderNumber }
  );

  const lineItem = draft.data.lineItems?.[0];
  if (lineItem) {
    assertEqual(Number(lineItem.groupDiscount), 0, "Draft groupDiscount is 0");
    assertEqual(Number(lineItem.finalPrice), Number(lineItem.basePrice), "Draft finalPrice equals basePrice");
  }

  const orderId = draft.data.id;

  // Step 5: Edit draft — change qty to 10
  const edit = await api("PUT", `/orders/${orderId}`, agent.accessToken, {
    lineItems: [{ variantId: variant.variantId, qty: 10, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(edit.status, 200, "Edit draft returns 200");
  assertEqual(edit.data.lineItems?.[0]?.qty, 10, "Edited qty is 10");

  // Step 6: Submit
  const submit = await api("POST", `/orders/${orderId}/submit`, agent.accessToken);
  assertEqual(submit.status, 200, "Submit returns 200");
  assertEqual(submit.data.status, "submitted", "Status is 'submitted' after submit");

  const submittedLine = submit.data.lineItems?.[0];
  if (submittedLine) {
    assert(
      Number(submittedLine.finalPrice) === Number(submittedLine.basePrice) - Number(submittedLine.groupDiscount || 0),
      "Submitted finalPrice = basePrice - groupDiscount",
      {
        finalPrice: submittedLine.finalPrice,
        basePrice: submittedLine.basePrice,
        groupDiscount: submittedLine.groupDiscount,
      }
    );
  }

  // Step 7: Record stock before approve
  const manager = await loginAs("manager");
  const stockBefore = await getStock(variant.variantId, manager.accessToken);
  console.log(`  Stock before approve: available=${stockBefore.availableQty}, reserved=${stockBefore.reservedQty}`);

  // Step 8: Approve
  const approve = await api("POST", `/orders/${orderId}/approve`, manager.accessToken, {
    versionLock: submit.data.versionLock,
  });
  assertEqual(approve.status, 200, "Approve returns 200");
  assertEqual(approve.data.status, "approved", "Status is 'approved'");

  // Step 9: Check stock after approve
  const stockAfterApprove = await getStock(variant.variantId, manager.accessToken);
  assertEqual(
    stockAfterApprove.reservedQty,
    stockBefore.reservedQty + 10,
    "Reserved qty increased by order qty (10) after approve"
  );

  // Step 10: Fulfill
  const fulfill = await api("POST", `/orders/${orderId}/fulfill`, manager.accessToken);
  assertEqual(fulfill.status, 200, "Fulfill returns 200");
  assertEqual(fulfill.data.status, "fulfilled", "Status is 'fulfilled'");

  // Step 11: Check stock after fulfill
  const stockAfterFulfill = await getStock(variant.variantId, manager.accessToken);
  assertEqual(
    stockAfterFulfill.availableQty,
    stockBefore.availableQty - 10,
    "Available qty decreased by order qty (10) after fulfill"
  );
  assertEqual(
    stockAfterFulfill.reservedQty,
    stockBefore.reservedQty,
    "Reserved qty back to pre-approve level after fulfill"
  );

  return printSummary("S1: Full Order Lifecycle");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
