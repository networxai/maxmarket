// tests/qa/s05-optimistic-lock.ts
// S5: Optimistic Lock Conflict

import {
  api, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, createDraft, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S5: Optimistic Lock Conflict\n");

  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");
  const admin = await loginAs("admin");

  const variant = await getFirstVariant(agent.accessToken);
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  // Create → submit → approve an order
  const draft = await createDraft(agent.accessToken, clientId, variant.variantId, 3);
  assertEqual(draft.status, 201, "Draft created");
  const orderId = draft.data.id;

  const submit = await api("POST", `/orders/${orderId}/submit`, agent.accessToken);
  assertEqual(submit.status, 200, "Order submitted");

  const approve = await api("POST", `/orders/${orderId}/approve`, manager.accessToken, {
    versionLock: submit.data.versionLock,
  });
  assertEqual(approve.status, 200, "Order approved");

  // Now the order is "approved" — both admin and manager read it and get the same versionLock
  const staleLock = approve.data.versionLock;
  console.log(`  versionLock after approve: ${staleLock}`);

  // Admin does a version edit with the current lock → succeeds (lock increments)
  const edit = await api("PUT", `/orders/${orderId}`, admin.accessToken, {
    lineItems: [{ variantId: variant.variantId, qty: 7, warehouseId: WAREHOUSE_ID }],
    notes: "S5 lock conflict test",
    versionLock: staleLock,
  });
  assertEqual(edit.status, 200, "Admin version edit with current lock succeeds");

  // Re-approve so the order is back in "approved" state for the next edit attempt
  const reapprove = await api("POST", `/orders/${orderId}/approve`, manager.accessToken, {
    versionLock: edit.data.versionLock,
  });
  assertEqual(reapprove.status, 200, "Re-approved after version edit");
  const lockAfterReapprove = reapprove.data.versionLock;
  console.log(`  versionLock after re-approve: ${lockAfterReapprove}`);

  // Now try an edit with the original stale lock → should get conflict
  const conflict = await api("PUT", `/orders/${orderId}`, admin.accessToken, {
    lineItems: [{ variantId: variant.variantId, qty: 9, warehouseId: WAREHOUSE_ID }],
    notes: "S5 stale lock attempt",
    versionLock: staleLock,
  });
  assertEqual(conflict.status, 409, "Stale lock returns 409");
  assertEqual(conflict.data?.errorCode, "OPTIMISTIC_LOCK_CONFLICT", "Error code is OPTIMISTIC_LOCK_CONFLICT");

  return printSummary("S5: Optimistic Lock Conflict");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
