// tests/qa/debug-price-override.ts

const API = "http://localhost:3000/api/v1";
const WH = "00000000-0000-0000-0000-000000000010";

async function main() {
  // Login
  const agentLogin = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "agent1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const agent = await agentLogin.json();

  const managerLogin = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "manager1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const manager = await managerLogin.json();

  // Get client + variant
  const clientsRes = await fetch(`${API}/users/${agent.user.id}/clients`, {
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const clients = await clientsRes.json();
  const clientId = clients.data[0].id;

  const catRes = await fetch(`${API}/catalog/products`, {
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const cat = await catRes.json();
  const variantId = (cat.data || cat)[0].variants[0].id;

  // Create + submit
  const draftRes = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.accessToken}` },
    body: JSON.stringify({ clientId, lineItems: [{ variantId, qty: 3, warehouseId: WH }] }),
  });
  const draft = await draftRes.json();
  const orderId = draft.id;

  const submitRes = await fetch(`${API}/orders/${orderId}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const submitted = await submitRes.json();
  const lineItemId = submitted.lineItems[0].id;
  console.log("Order:", orderId);
  console.log("LineItem:", lineItemId);
  console.log("Current finalPrice:", submitted.lineItems[0].finalPrice);

  // Try override with different body shapes
  console.log("\n=== ATTEMPT 1: { overridePrice: 99.99 } ===");
  const r1 = await fetch(`${API}/orders/${orderId}/line-items/${lineItemId}/override-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.accessToken}` },
    body: JSON.stringify({ overridePrice: 99.99 }),
  });
  console.log("Status:", r1.status);
  console.log("Response:", JSON.stringify(await r1.json(), null, 2));

  console.log("\n=== ATTEMPT 2: { price: 99.99 } ===");
  const r2 = await fetch(`${API}/orders/${orderId}/line-items/${lineItemId}/override-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.accessToken}` },
    body: JSON.stringify({ price: 99.99 }),
  });
  console.log("Status:", r2.status);
  console.log("Response:", JSON.stringify(await r2.json(), null, 2));

  console.log("\n=== ATTEMPT 3: { finalPrice: 99.99 } ===");
  const r3 = await fetch(`${API}/orders/${orderId}/line-items/${lineItemId}/override-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.accessToken}` },
    body: JSON.stringify({ finalPrice: 99.99 }),
  });
  console.log("Status:", r3.status);
  console.log("Response:", JSON.stringify(await r3.json(), null, 2));

  console.log("\n=== ATTEMPT 4: { managerOverride: 99.99 } ===");
  const r4 = await fetch(`${API}/orders/${orderId}/line-items/${lineItemId}/override-price`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.accessToken}` },
    body: JSON.stringify({ managerOverride: 99.99 }),
  });
  console.log("Status:", r4.status);
  console.log("Response:", JSON.stringify(await r4.json(), null, 2));

  // Also try PUT instead of POST
  console.log("\n=== ATTEMPT 5: PUT with { overridePrice: 99.99 } ===");
  const r5 = await fetch(`${API}/orders/${orderId}/line-items/${lineItemId}/override-price`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.accessToken}` },
    body: JSON.stringify({ overridePrice: 99.99 }),
  });
  console.log("Status:", r5.status);
  console.log("Response:", JSON.stringify(await r5.json(), null, 2));
}

main().catch(e => console.error("Fatal:", e));
