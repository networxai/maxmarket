// tests/qa/debug-product-approve.ts

const API = "http://localhost:3000/api/v1";
const WH = "00000000-0000-0000-0000-000000000010";

async function main() {
  const adminLogin = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const admin = await adminLogin.json();

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

  // Get category
  const catRes = await fetch(`${API}/catalog/categories`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  const cats = await catRes.json();
  const categoryId = (cats.data || cats)[0]?.id;

  // Create product
  const sku = `DBG-${Date.now()}`;
  const prodRes = await fetch(`${API}/catalog/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.accessToken}` },
    body: JSON.stringify({
      name: { en: "Debug Product" },
      description: { en: "Debug" },
      categoryId,
      variants: [{ sku, unitType: "piece", pricePerUnit: 25, costPrice: 10, minOrderQty: 1, isActive: true }],
    }),
  });
  const product = await prodRes.json();
  console.log("Product created:", prodRes.status);
  const variantId = product.variants?.[0]?.id;
  console.log("Variant ID:", variantId);

  // Set stock
  const stockRes = await fetch(`${API}/inventory/stock/adjust`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.accessToken}` },
    body: JSON.stringify({ warehouseId: WH, variantId, newAvailableQty: 1000, reason: "debug" }),
  });
  console.log("Stock adjust:", stockRes.status, JSON.stringify(await stockRes.json()));

  // Check stock
  const checkStock = await fetch(`${API}/inventory/stock?variantId=${variantId}`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  console.log("Stock check:", JSON.stringify(await checkStock.json()));

  // Get client
  const clientsRes = await fetch(`${API}/users/${agent.user.id}/clients`, {
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const clients = await clientsRes.json();
  const clientId = (clients.data || clients)[0]?.id;

  // Create draft
  const draftRes = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.accessToken}` },
    body: JSON.stringify({ clientId, lineItems: [{ variantId, qty: 2, warehouseId: WH }] }),
  });
  const draft = await draftRes.json();
  console.log("\nDraft:", draftRes.status, "id:", draft.id);

  // Submit
  const submitRes = await fetch(`${API}/orders/${draft.id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const submitted = await submitRes.json();
  console.log("Submit:", submitRes.status, "versionLock:", submitted.versionLock);

  // Approve
  const approveRes = await fetch(`${API}/orders/${draft.id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.accessToken}` },
    body: JSON.stringify({ versionLock: submitted.versionLock }),
  });
  console.log("Approve:", approveRes.status);
  console.log("Approve response:", JSON.stringify(await approveRes.json(), null, 2));
}

main().catch(e => console.error("Fatal:", e));
