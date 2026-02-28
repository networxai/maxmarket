// tests/qa/s03-price-override.ts
// S3: Manager Price Override

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getFirstVariant, getAgentClients, assertAbsentOrNull, createDraft,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S3: Manager Price Override\n");

  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");
  const client1 = await loginAs("client1");

  const variant = await getFirstVariant(agent.accessToken);
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  // Step 1: Agent creates and submits order
  const draft = await createDraft(agent.accessToken, clientId, variant.variantId, 3);
  assertEqual(draft.status, 201, "Draft created");
  const orderId = draft.data.id;

  const submit = await api("POST", `/orders/${orderId}/submit`, agent.accessToken);
  assertEqual(submit.status, 200, "Order submitted");

  // Step 2: Note lineItem finalPrice before override
  const lineItemId = submit.data.lineItems[0].id || submit.data.lineItems[0].lineItemId;
  const priceBefore = submit.data.lineItems[0].finalPrice;
  console.log(`  Price before override: ${priceBefore}`);

  // Step 3: Manager overrides price to 99.99
  const override = await api(
    "POST",
    `/orders/${orderId}/line-items/${lineItemId}/override-price`,
    manager.accessToken,
    { managerOverride: 99.99 }
  );
  assertEqual(override.status, 200, "Price override returns 200");
  assertEqual(Number(override.data?.lineItems?.[0]?.finalPrice ?? override.data?.finalPrice), 99.99, "Override finalPrice is 99.99");

  // Step 4: Refetch as manager → verify
  const refetch = await api("GET", `/orders/${orderId}`, manager.accessToken);
  const managerLine = refetch.data?.lineItems?.[0];
  assertEqual(Number(managerLine?.finalPrice), 99.99, "Refetched line finalPrice is 99.99");

  // Step 5: Approve
  const approve = await api("POST", `/orders/${orderId}/approve`, manager.accessToken, {
    versionLock: refetch.data.versionLock ?? submit.data.versionLock,
  });
  assertEqual(approve.status, 200, "Order approved");
  assertEqual(Number(approve.data?.lineItems?.[0]?.finalPrice), 99.99, "Price still 99.99 after approve");

  // Step 6: Client1 view — sensitive fields hidden
  const clientView = await api("GET", `/orders/${orderId}`, client1.accessToken);
  assertEqual(clientView.status, 200, "Client can view order");
  const clientLine = clientView.data?.lineItems?.[0];
  assertEqual(Number(clientLine?.finalPrice), 99.99, "Client sees finalPrice 99.99");

  assertAbsentOrNull(clientLine, "groupDiscount", "Client does not see groupDiscount");
  assertAbsentOrNull(clientLine, "managerOverride", "Client does not see managerOverride");
  assertAbsentOrNull(clientLine, "basePrice", "Client does not see basePrice");
  assertAbsentOrNull(clientView.data, "agentId", "Client does not see agentId");

  return printSummary("S3: Manager Price Override");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
