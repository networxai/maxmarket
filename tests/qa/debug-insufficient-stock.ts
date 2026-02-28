// tests/qa/debug-insufficient-stock.ts

const API = "http://localhost:3000/api/v1";
const WH = "00000000-0000-0000-0000-000000000010";

async function main() {
  // Login admin + agent
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

  // Get client and variant
  const clientsRes = await fetch(`${API}/users/${agent.user.id}/clients`, {
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const clients = await clientsRes.json();
  const clientId = clients.data[0].id;

  // Use a variant with known stock
  const stockRes = await fetch(`${API}/inventory/stock`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  const stockData = await stockRes.json();
  console.log("=== All stock ===");
  for (const s of (stockData.data || stockData)) {
    console.log(`  ${s.sku}: available=${s.availableQty}, reserved=${s.reservedQty}, free=${s.availableQty - s.reservedQty}`);
  }

  // Pick a variant with decent stock
  const variant = (stockData.data || stockData).find((s: any) => s.availableQty >= 50);
  if (!variant) { console.log("No variant with enough stock!"); return; }
  console.log(`\nUsing variant: ${variant.sku} (${variant.variantId}), available=${variant.availableQty}, reserved=${variant.reservedQty}`);

  // Try creating draft with qty > available
  const overQty = variant.availableQty + 10;
  console.log(`\n=== Create draft with qty=${overQty} (over available=${variant.availableQty}) ===`);
  const draft1 = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.accessToken}` },
    body: JSON.stringify({ clientId, lineItems: [{ variantId: variant.variantId, qty: overQty, warehouseId: WH }] }),
  });
  console.log("Status:", draft1.status);
  console.log("Response:", JSON.stringify(await draft1.json(), null, 2));

  // Try creating draft with qty = available - reserved (exactly free)
  const freeQty = variant.availableQty - variant.reservedQty;
  console.log(`\n=== Create draft with qty=${freeQty} (exactly free) ===`);
  const draft2 = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.accessToken}` },
    body: JSON.stringify({ clientId, lineItems: [{ variantId: variant.variantId, qty: freeQty, warehouseId: WH }] }),
  });
  console.log("Status:", draft2.status);
  console.log("Response:", JSON.stringify(await draft2.json(), null, 2));

  // Try creating draft with qty=1 (minimal)
  console.log(`\n=== Create draft with qty=1 ===`);
  const draft3 = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.accessToken}` },
    body: JSON.stringify({ clientId, lineItems: [{ variantId: variant.variantId, qty: 1, warehouseId: WH }] }),
  });
  console.log("Status:", draft3.status);
  console.log("Response:", JSON.stringify(await draft3.json(), null, 2));
}

main().catch(e => console.error("Fatal:", e));
