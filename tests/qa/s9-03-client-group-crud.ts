// tests/qa/s9-03-client-group-crud.ts
// S9-3: Client Group CRUD + Constraint

import {
  api, assert, assertEqual, resetCounters, printSummary, loginAs,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-3: Client Group CRUD + Constraint\n");

  const admin = await loginAs("admin");
  const sa = await loginAs("super_admin");

  // Step 1: Create group
  const groupName = `Test Group ${Date.now()}`;
  const createGroup = await api("POST", "/client-groups", admin.accessToken, {
    name: groupName,
    discountType: "percentage",
    discountValue: 20,
  });
  assertEqual(createGroup.status, 201, "Admin creates client group");
  const groupId = createGroup.data?.id;
  assert(!!groupId, "Group has id");

  // Step 2: Verify in list
  const list = await api("GET", "/client-groups", admin.accessToken);
  assertEqual(list.status, 200, "GET /client-groups returns 200");
  const groups = list.data?.data || list.data || [];
  const found = groups.find((g: any) => g.id === groupId);
  assert(!!found, "New group appears in list");

  // Step 3: Create a client in the test group
  const clientEmail = `qa-client-${Date.now()}@maxmarket.com`;
  const createClient = await api("POST", "/users", sa.accessToken, {
    email: clientEmail,
    password: "ChangeMe1!",
    fullName: "QA Group Client",
    role: "client",
    clientGroupId: groupId,
  });
  assertEqual(createClient.status, 201, "Super admin creates client in test group");
  const clientId = createClient.data?.id;

  // Step 4: Try to delete group with assigned clients → 409
  const deleteBlocked = await api("DELETE", `/client-groups/${groupId}`, admin.accessToken);
  assertEqual(deleteBlocked.status, 409, "Cannot delete group with clients assigned (409)");

  // Step 5: Move client to a different group
  // Get an existing group to move to
  const otherGroup = groups.find((g: any) => g.id !== groupId);
  assert(!!otherGroup, "Found another group to move client to");

  const moveClient = await api("PUT", `/users/${clientId}`, sa.accessToken, {
    clientGroupId: otherGroup.id,
  });
  assertEqual(moveClient.status, 200, "Client moved to different group");

  // Step 6: Delete group now → should succeed
  const deleteOk = await api("DELETE", `/client-groups/${groupId}`, admin.accessToken);
  assert(deleteOk.status === 200 || deleteOk.status === 204, "Delete empty group succeeds", { status: deleteOk.status });

  // Step 7: Agent cannot create groups
  const agent = await loginAs("agent1");
  const agentCreate = await api("POST", "/client-groups", agent.accessToken, {
    name: "Agent Group Attempt",
    discountType: "percentage",
    discountValue: 5,
  });
  assertEqual(agentCreate.status, 403, "Agent cannot create client groups (403)");

  // Step 8: Manager cannot delete groups
  const manager = await loginAs("manager");
  // Use any existing group ID for the attempt
  if (otherGroup) {
    const managerDelete = await api("DELETE", `/client-groups/${otherGroup.id}`, manager.accessToken);
    assertEqual(managerDelete.status, 403, "Manager cannot delete client groups (403)");
  }

  return printSummary("S9-3: Client Group CRUD + Constraint");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
