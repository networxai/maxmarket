// tests/qa/s10-draft-delete.ts
// S10: Draft Delete

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, createDraft,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S10: Draft Delete\n");

  const agent1 = await loginAs("agent1");
  const agent2 = await loginAs("agent2");

  const variant = await getFirstVariant(agent1.accessToken);
  const agent1Clients = await getAgentClients(agent1.user.id, agent1.accessToken);
  const clientId = agent1Clients[0].id || agent1Clients[0].clientId;

  // Step 1: Agent1 creates draft → deletes → 200
  const draft1 = await createDraft(agent1.accessToken, clientId, variant.variantId, 2);
  assertEqual(draft1.status, 201, "Draft created for delete test");
  const deleteRes = await api("DELETE", `/orders/${draft1.data.id}`, agent1.accessToken);
  assert(deleteRes.status === 200 || deleteRes.status === 204, "Delete draft returns 200 or 204", { status: deleteRes.status });

  // Step 2: GET deleted order → 404
  const getDeleted = await api("GET", `/orders/${draft1.data.id}`, agent1.accessToken);
  assertEqual(getDeleted.status, 404, "Deleted order returns 404");

  // Step 3: Create → submit → try delete → 422
  const draft2 = await createDraft(agent1.accessToken, clientId, variant.variantId, 2);
  assertEqual(draft2.status, 201, "Second draft created");
  const submit = await api("POST", `/orders/${draft2.data.id}/submit`, agent1.accessToken);
  assertEqual(submit.status, 200, "Order submitted");
  const deleteSub = await api("DELETE", `/orders/${draft2.data.id}`, agent1.accessToken);
  assertEqual(deleteSub.status, 422, "Cannot delete submitted order → 422");

  // Step 4: Agent1 creates draft → Agent2 tries to delete → 403
  const draft3 = await createDraft(agent1.accessToken, clientId, variant.variantId, 2);
  assertEqual(draft3.status, 201, "Third draft created");
  const crossDelete = await api("DELETE", `/orders/${draft3.data.id}`, agent2.accessToken);
  assertEqual(crossDelete.status, 403, "Agent2 cannot delete agent1's draft → 403");

  return printSummary("S10: Draft Delete");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
