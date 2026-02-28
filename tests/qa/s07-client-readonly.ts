// tests/qa/s07-client-readonly.ts
// S7: Client Read-Only

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, assertAbsentOrNull, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S7: Client Read-Only\n");

  const client1 = await loginAs("client1");

  // Step 1: Client lists orders
  const orderList = await api("GET", "/orders", client1.accessToken);
  assertEqual(orderList.status, 200, "Client1 can list orders");
  const orders = orderList.data?.data || orderList.data || [];

  if (orders.length > 0) {
    // Verify all orders belong to client1
    const allOwn = orders.every((o: any) => o.clientId === client1.user.id);
    assert(allOwn, "All listed orders belong to client1");

    // Step 2: Pick an order and verify field visibility
    const order = orders[0];
    const orderId = order.id;

    const detail = await api("GET", `/orders/${orderId}`, client1.accessToken);
    assertEqual(detail.status, 200, "Client1 can view order detail");

    assertAbsentOrNull(detail.data, "agentId", "Client does not see agentId");

    const lineItems = detail.data?.lineItems || [];
    if (lineItems.length > 0) {
      const li = lineItems[0];
      assertAbsentOrNull(li, "groupDiscount", "LineItem has no groupDiscount for client");
      assert(li.finalPrice !== undefined && li.finalPrice !== null, "LineItem has finalPrice");
    }

    // Step 3-11: All mutations should return 403
    const mutations: [string, string, any?][] = [
      ["POST", "/orders", { clientId: client1.user.id, lineItems: [{ variantId: "fake", qty: 1, warehouseId: WAREHOUSE_ID }] }],
      ["POST", `/orders/${orderId}/approve`, { versionLock: 1 }],
      ["POST", `/orders/${orderId}/reject`, { reason: "test" }],
      ["PUT", `/orders/${orderId}`, { lineItems: [] }],
      ["DELETE", `/orders/${orderId}`, undefined],
      ["POST", `/orders/${orderId}/submit`, undefined],
      ["POST", `/orders/${orderId}/fulfill`, undefined],
      ["POST", `/orders/${orderId}/cancel`, undefined],
      ["POST", `/orders/${orderId}/return`, undefined],
    ];

    for (const [method, path, body] of mutations) {
      const res = await api(method, path, client1.accessToken, body);
      assertEqual(res.status, 403, `Client1 forbidden: ${method} ${path}`);
    }
  } else {
    console.log("  ⚠️  No orders found for client1 — skipping detail tests. Create orders first.");
    assert(false, "Client1 should have at least one order to test against");
  }

  return printSummary("S7: Client Read-Only");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
