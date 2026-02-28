// tests/qa/s9-02-agent-client-assign.ts
// S9-2: Agent-Client Assignment

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getAgentClients, createDraft, WAREHOUSE_ID, getFirstVariant,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-2: Agent-Client Assignment\n");

  const sa = await loginAs("super_admin");
  const agent2 = await loginAs("agent2");

  // Get client2's ID
  const admin = await loginAs("admin");
  const usersRes = await api("GET", "/users?role=client", admin.accessToken);
  const allClients = usersRes.data?.data || usersRes.data || [];
  const client2 = allClients.find((u: any) => u.email === "client2@maxmarket.com");
  assert(!!client2, "Found client2");
  const client2Id = client2.id;
  const agent2Id = agent2.user.id;

  // Check if client2 is already assigned to agent2, if so remove first
  const existing = await api("GET", `/users/${agent2Id}/clients`, sa.accessToken);
  const existingClients = existing.data?.data || existing.data || [];
  const alreadyAssigned = existingClients.find((c: any) => c.id === client2Id);
  if (alreadyAssigned) {
    await api("DELETE", `/users/${agent2Id}/clients/${client2Id}`, sa.accessToken);
    console.log("  Cleaned up existing assignment");
  }

  // Step 1: Assign client2 to agent2
  const assign = await api("POST", `/users/${agent2Id}/clients/${client2Id}`, sa.accessToken);
  assert(assign.status === 200 || assign.status === 201, "Assign client2 to agent2", { status: assign.status });

  // Step 2: Verify assignment
  const clients = await getAgentClients(agent2Id, agent2.accessToken);
  const hasClient2 = clients.some((c: any) => c.id === client2Id || c.clientId === client2Id);
  assert(hasClient2, "Agent2's client list includes client2");

  // Step 3: Agent2 can create order for client2
  const variant = await getFirstVariant(agent2.accessToken);
  const draft = await createDraft(agent2.accessToken, client2Id, variant.variantId, 1);
  assertEqual(draft.status, 201, "Agent2 can create order for assigned client2");

  // Step 4: Remove client2 from agent2
  const unassign = await api("DELETE", `/users/${agent2Id}/clients/${client2Id}`, sa.accessToken);
  assert(unassign.status === 200 || unassign.status === 204, "Unassign client2 from agent2", { status: unassign.status });

  // Step 5: Agent2 can no longer create order for client2
  const forbidden = await createDraft(agent2.accessToken, client2Id, variant.variantId, 1);
  assertEqual(forbidden.status, 403, "Agent2 cannot create order for unassigned client2");

  // Step 6: Assign same client twice → 409
  const reassign = await api("POST", `/users/${agent2Id}/clients/${client2Id}`, sa.accessToken);
  assert(reassign.status === 200 || reassign.status === 201, "Re-assign client2", { status: reassign.status });
  const duplicate = await api("POST", `/users/${agent2Id}/clients/${client2Id}`, sa.accessToken);
  assertEqual(duplicate.status, 409, "Duplicate assignment returns 409");

  // Cleanup: leave client2 assigned to agent2 if needed by other tests
  return printSummary("S9-2: Agent-Client Assignment");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
