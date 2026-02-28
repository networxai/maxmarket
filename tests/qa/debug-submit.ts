// tests/qa/debug-submit.ts

const API = "http://localhost:3000/api/v1";
const WH = "00000000-0000-0000-0000-000000000010";

async function main() {
  // Login as agent1
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "agent1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const { accessToken: token, user } = await loginRes.json();

  // Get client
  const clientsRes = await fetch(`${API}/users/${user.id}/clients`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const clientsData = await clientsRes.json();
  const clientId = clientsData.data[0].id;

  // Get variant
  const catRes = await fetch(`${API}/catalog/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const catData = await catRes.json();
  const variantId = (catData.data || catData)[0].variants[0].id;

  // Create draft
  const draftRes = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ clientId, lineItems: [{ variantId, qty: 5, warehouseId: WH }] }),
  });
  const draft = await draftRes.json();
  console.log("Draft created:", draft.id, "status:", draft.status);
  console.log("Draft versionLock:", draft.versionLock);

  const orderId = draft.id;

  // Try submit as POST
  console.log("\n=== POST /orders/{id}/submit (no body) ===");
  const sub1 = await fetch(`${API}/orders/${orderId}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Status:", sub1.status);
  console.log("Response:", JSON.stringify(await sub1.json(), null, 2));

  // If that failed, try with Content-Type
  if (sub1.status !== 200) {
    console.log("\n=== POST /orders/{id}/submit (with Content-Type, empty body) ===");
    const sub2 = await fetch(`${API}/orders/${orderId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    console.log("Status:", sub2.status);
    console.log("Response:", JSON.stringify(await sub2.json(), null, 2));
  }

  // Try with versionLock
  if (sub1.status !== 200) {
    console.log("\n=== POST /orders/{id}/submit (with versionLock) ===");
    const sub3 = await fetch(`${API}/orders/${orderId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ versionLock: draft.versionLock }),
    });
    console.log("Status:", sub3.status);
    console.log("Response:", JSON.stringify(await sub3.json(), null, 2));
  }

  // Try PATCH instead of POST
  if (sub1.status !== 200) {
    // Re-create a fresh draft since previous might have changed state
    const draft2Res = await fetch(`${API}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId, lineItems: [{ variantId, qty: 3, warehouseId: WH }] }),
    });
    const draft2 = await draft2Res.json();

    console.log("\n=== PATCH /orders/{id}/submit ===");
    const sub4 = await fetch(`${API}/orders/${draft2.id}/submit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    console.log("Status:", sub4.status);
    console.log("Response:", JSON.stringify(await sub4.json(), null, 2));
  }
}

main().catch(e => console.error("Fatal:", e));
