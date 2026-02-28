// tests/qa/edge-cases.ts
// QA8.4: Edge Cases

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, createDraft, createApprovedOrder, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 QA8.4: Edge Cases\n");

  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");
  const admin = await loginAs("admin");

  const variant = await getFirstVariant(agent.accessToken);
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  // Reset stock to ensure we have plenty
  await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId: variant.variantId,
    newAvailableQty: 1000,
    reason: "QA edge cases — ensure sufficient stock",
  });

  // 1. Empty lineItems
  const emptyItems = await api("POST", "/orders", agent.accessToken, {
    clientId,
    lineItems: [],
  });
  assertEqual(emptyItems.status, 422, "Empty lineItems → 422");

  // 2. Qty = 0
  const zeroQty = await api("POST", "/orders", agent.accessToken, {
    clientId,
    lineItems: [{ variantId: variant.variantId, qty: 0, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(zeroQty.status, 422, "Qty=0 → 422");

  // 3. Submit non-draft (submit a submitted order)
  const draft1 = await createDraft(agent.accessToken, clientId, variant.variantId, 2);
  await api("POST", `/orders/${draft1.data.id}/submit`, agent.accessToken);
  const resubmit = await api("POST", `/orders/${draft1.data.id}/submit`, agent.accessToken);
  assertEqual(resubmit.status, 422, "Submit non-draft → 422");

  // 4. Approve non-submitted (approve a draft)
  const draft2 = await createDraft(agent.accessToken, clientId, variant.variantId, 2);
  const approveDraft = await api("POST", `/orders/${draft2.data.id}/approve`, manager.accessToken, {
    versionLock: draft2.data.versionLock || 1,
  });
  assertEqual(approveDraft.status, 422, "Approve draft → 422");

  // 5. Fulfill non-approved (fulfill a submitted order)
  const draft3 = await createDraft(agent.accessToken, clientId, variant.variantId, 2);
  await api("POST", `/orders/${draft3.data.id}/submit`, agent.accessToken);
  const fulfillSub = await api("POST", `/orders/${draft3.data.id}/fulfill`, manager.accessToken);
  assertEqual(fulfillSub.status, 422, "Fulfill submitted → 422");

  // 6. Cancel non-approved (cancel a submitted order)
  const draft4 = await createDraft(agent.accessToken, clientId, variant.variantId, 2);
  await api("POST", `/orders/${draft4.data.id}/submit`, agent.accessToken);
  const cancelSub = await api("POST", `/orders/${draft4.data.id}/cancel`, manager.accessToken);
  assertEqual(cancelSub.status, 422, "Cancel submitted → 422");

  // 7. Return non-fulfilled (return an approved order)
  const approved = await createApprovedOrder(
    agent.accessToken, manager.accessToken, clientId, variant.variantId, 2
  );
  const returnApproved = await api("POST", `/orders/${approved.id}/return`, manager.accessToken);
  assertEqual(returnApproved.status, 422, "Return approved → 422");

  // 8. Edit rejected order
  const draft5 = await createDraft(agent.accessToken, clientId, variant.variantId, 2);
  const sub5 = await api("POST", `/orders/${draft5.data.id}/submit`, agent.accessToken);
  await api("POST", `/orders/${draft5.data.id}/reject`, manager.accessToken, {
    reason: "QA test rejection",
    versionLock: sub5.data.versionLock,
  });
  const editRejected = await api("PUT", `/orders/${draft5.data.id}`, agent.accessToken, {
    lineItems: [{ variantId: variant.variantId, qty: 3, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(editRejected.status, 422, "Edit rejected order → 422");
  assertEqual(editRejected.data?.errorCode, "ORDER_NOT_EDITABLE", "Error code is ORDER_NOT_EDITABLE");

  // 9. Version edit without versionLock
  const approved2 = await createApprovedOrder(
    agent.accessToken, manager.accessToken, clientId, variant.variantId, 2
  );
  const editNoLock = await api("PUT", `/orders/${approved2.id}`, admin.accessToken, {
    lineItems: [{ variantId: variant.variantId, qty: 5, warehouseId: WAREHOUSE_ID }],
    notes: "No lock test",
    // deliberately omitting versionLock
  });
  assert(
    editNoLock.status === 422 || editNoLock.status === 400 || editNoLock.status === 409,
    "Edit approved order without versionLock fails (422, 400, or 409)",
    { status: editNoLock.status }
  );

  // 10. Non-existent order
  const fakeId = "00000000-0000-0000-0000-000000000000";
  const notFound = await api("GET", `/orders/${fakeId}`, manager.accessToken);
  assertEqual(notFound.status, 404, "Non-existent order → 404");

  return printSummary("QA8.4: Edge Cases");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
