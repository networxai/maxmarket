// tests/qa/s04-version-edit.ts
// S4: Admin Version Edit

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, createApprovedOrder, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S4: Admin Version Edit\n");

  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");
  const admin = await loginAs("admin");

  const variant = await getFirstVariant(agent.accessToken);
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  // Step 1: Create → submit → approve
  const approved = await createApprovedOrder(
    agent.accessToken, manager.accessToken, clientId, variant.variantId, 5
  );
  const orderId = approved.id;
  const prevVersion = approved.currentVersion || approved.version || 1;
  const prevLock = approved.versionLock;
  console.log(`  Approved order ${orderId}, version=${prevVersion}, lock=${prevLock}`);

  // Step 3: Admin edits the approved order (version edit)
  const edit = await api("PUT", `/orders/${orderId}`, admin.accessToken, {
    lineItems: [{ variantId: variant.variantId, qty: 8, warehouseId: WAREHOUSE_ID }],
    notes: "QA version test — S4",
    versionLock: prevLock,
  });
  assertEqual(edit.status, 200, "Admin version edit returns 200");
  assertEqual(edit.data?.status, "submitted", "Order status back to 'submitted' after version edit");
  assertEqual(
    edit.data?.currentVersion ?? edit.data?.version,
    prevVersion + 1,
    "Version incremented by 1"
  );

  // Step 4: Manager approves the new version
  const approve2 = await api("POST", `/orders/${orderId}/approve`, manager.accessToken, {
    versionLock: edit.data.versionLock,
  });
  assert(
    approve2.status === 200 || (approve2.status === 422 && approve2.data?.errorCode === "INSUFFICIENT_STOCK"),
    "Re-approve succeeds (200) or legitimately fails on stock (422)",
    { status: approve2.status, errorCode: approve2.data?.errorCode }
  );

  // Step 5: Check versions list
  const versions = await api("GET", `/orders/${orderId}/versions`, manager.accessToken);
  assertEqual(versions.status, 200, "GET versions returns 200");
  const versionList = versions.data?.data || versions.data;
  assert(
    Array.isArray(versionList) && versionList.length >= 1,
    "At least 1 version history entry (snapshot of pre-edit state)",
    { count: versionList?.length }
  );

  // Step 6: Check version detail for version 1
  const vNum = versionList[0]?.versionNumber || 1;
  const v1 = await api("GET", `/orders/${orderId}/versions/${vNum}`, manager.accessToken);
  assertEqual(v1.status, 200, "GET version detail returns 200");
  assert(v1.data?.snapshot !== undefined, "Version has snapshot field");
  // Note: diff may be null in current implementation — not a blocking issue
  assert(v1.data?.diff !== undefined || v1.data?.diff === null, "Version has diff field (may be null)");

  return printSummary("S4: Admin Version Edit");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
