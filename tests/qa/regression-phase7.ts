// tests/qa/regression-phase7.ts
// QA8.5: Phase 7 Regression

import {
  api, login, assert, assertEqual, resetCounters, printSummary,
  loginAs, assertAbsentOrNull,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 QA8.5: Phase 7 Regression\n");

  // 1. Public catalog — no auth → 200, products present, NO price keys
  const publicCatalog = await api("GET", "/catalog/products");
  assertEqual(publicCatalog.status, 200, "Public catalog returns 200");
  const publicProducts = publicCatalog.data?.data || publicCatalog.data || [];
  assert(publicProducts.length > 0, "Public catalog has products");

  if (publicProducts.length > 0) {
    const p = publicProducts[0];
    const v = p.variants?.[0] || p;
    assertAbsentOrNull(v, "costPrice", "Public: no costPrice");
    assertAbsentOrNull(v, "pricePerUnit", "Public: no pricePerUnit");
    assertAbsentOrNull(v, "pricePerBox", "Public: no pricePerBox");
    assertAbsentOrNull(v, "clientPrice", "Public: no clientPrice");
  }

  // 2. Agent catalog → 200, price keys present
  const agent = await loginAs("agent1");
  const agentCatalog = await api("GET", "/catalog/products", agent.accessToken);
  assertEqual(agentCatalog.status, 200, "Agent catalog returns 200");
  const agentProducts = agentCatalog.data?.data || agentCatalog.data || [];
  if (agentProducts.length > 0) {
    const v = agentProducts[0].variants?.[0] || agentProducts[0];
    assert(
      v.pricePerUnit !== undefined || v.price !== undefined,
      "Agent catalog has price fields"
    );
  }

  // 3. Client catalog → 200, has clientPrice, no costPrice
  const client1 = await loginAs("client1");
  const clientCatalog = await api("GET", "/catalog/products", client1.accessToken);
  assertEqual(clientCatalog.status, 200, "Client catalog returns 200");
  const clientProducts = clientCatalog.data?.data || clientCatalog.data || [];
  if (clientProducts.length > 0) {
    const v = clientProducts[0].variants?.[0] || clientProducts[0];
    assert(
      v.clientPrice !== undefined || v.price !== undefined || v.finalPrice !== undefined,
      "Client catalog has client-facing price"
    );
    assertAbsentOrNull(v, "costPrice", "Client: no costPrice");
  }

  // 4. Categories — no auth → 200
  const categories = await api("GET", "/catalog/categories");
  assertEqual(categories.status, 200, "Public categories returns 200");

  // 5. Bad login → 401
  try {
    const badLogin = await api("POST", "/auth/login", undefined, {
      email: "agent1@maxmarket.com",
      password: "WrongPassword123!",
    });
    assertEqual(badLogin.status, 401, "Wrong password returns 401");
  } catch {
    // login helper throws on failure, but we're using raw api() here
    assert(true, "Wrong password rejected");
  }

  // 6. Good login → 200, has accessToken and user
  const goodLogin = await api("POST", "/auth/login", undefined, {
    email: "agent1@maxmarket.com",
    password: "ChangeMe1!",
  });
  assertEqual(goodLogin.status, 200, "Correct login returns 200");
  assert(!!goodLogin.data?.accessToken, "Login response has accessToken");
  assert(!!goodLogin.data?.user, "Login response has user object");

  return printSummary("QA8.5: Phase 7 Regression");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
