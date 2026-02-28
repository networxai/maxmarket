// tests/qa/debug-create-order.ts
// Diagnostic: inspect API responses for order creation

const API = "http://localhost:3000/api/v1";

async function main() {
  // Login as agent1
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "agent1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  const agentId = loginData.user.id;
  console.log("Agent1 ID:", agentId);
  console.log("Agent1 role:", loginData.user.role);

  // Get clients
  const clientsRes = await fetch(`${API}/users/${agentId}/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const clientsData = await clientsRes.json();
  console.log("\n--- Agent1 Clients ---");
  console.log(JSON.stringify(clientsData, null, 2));

  const clientId = clientsData?.data?.[0]?.id || clientsData?.[0]?.id || clientsData?.data?.[0]?.clientId;
  console.log("Using clientId:", clientId);

  // Get catalog
  const catalogRes = await fetch(`${API}/catalog/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const catalogData = await catalogRes.json();
  const firstProduct = (catalogData?.data || catalogData)?.[0];
  const firstVariant = firstProduct?.variants?.[0];
  console.log("\n--- First Product ---");
  console.log(JSON.stringify(firstProduct, null, 2).slice(0, 1000));
  console.log("\n--- First Variant ---");
  console.log(JSON.stringify(firstVariant, null, 2));

  const variantId = firstVariant?.id || firstVariant?.variantId;
  console.log("Using variantId:", variantId);

  // Attempt 1: As specified in the directive
  console.log("\n\n=== ATTEMPT 1: { clientId, lineItems: [{ variantId, qty }] } ===");
  const attempt1 = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId,
      lineItems: [{ variantId, qty: 5 }],
    }),
  });
  console.log("Status:", attempt1.status);
  const body1 = await attempt1.json();
  console.log("Response:", JSON.stringify(body1, null, 2));

  // Attempt 2: Maybe it wants quantity instead of qty
  console.log("\n\n=== ATTEMPT 2: { clientId, lineItems: [{ variantId, quantity }] } ===");
  const attempt2 = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId,
      lineItems: [{ variantId, quantity: 5 }],
    }),
  });
  console.log("Status:", attempt2.status);
  const body2 = await attempt2.json();
  console.log("Response:", JSON.stringify(body2, null, 2));

  // Attempt 3: Maybe it wants productVariantId
  console.log("\n\n=== ATTEMPT 3: { clientId, lineItems: [{ productVariantId, qty }] } ===");
  const attempt3 = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId,
      lineItems: [{ productVariantId: variantId, qty: 5 }],
    }),
  });
  console.log("Status:", attempt3.status);
  const body3 = await attempt3.json();
  console.log("Response:", JSON.stringify(body3, null, 2));

  // Attempt 4: Maybe it wants productVariantId + quantity
  console.log("\n\n=== ATTEMPT 4: { clientId, lineItems: [{ productVariantId, quantity }] } ===");
  const attempt4 = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      clientId,
      lineItems: [{ productVariantId: variantId, quantity: 5 }],
    }),
  });
  console.log("Status:", attempt4.status);
  const body4 = await attempt4.json();
  console.log("Response:", JSON.stringify(body4, null, 2));
}

main().catch(e => console.error("Fatal:", e));
