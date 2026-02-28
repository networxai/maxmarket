// tests/qa/debug-stock-create.ts

const API = "http://localhost:3000/api/v1";
const WH = "00000000-0000-0000-0000-000000000010";

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const { accessToken: token } = await loginRes.json();

  // Use a variant we know doesn't have stock
  const variantId = "7b78dbf9-9efd-453f-adfb-3ba8dc2d8142";

  // Attempt 1: POST /inventory/stock
  console.log("=== ATTEMPT 1: POST /inventory/stock ===");
  const r1 = await fetch(`${API}/inventory/stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ warehouseId: WH, variantId, availableQty: 100, reservedQty: 0 }),
  });
  console.log("Status:", r1.status);
  console.log("Response:", JSON.stringify(await r1.json(), null, 2));

  // Attempt 2: POST /inventory/stock/create
  console.log("\n=== ATTEMPT 2: POST /inventory/stock/create ===");
  const r2 = await fetch(`${API}/inventory/stock/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ warehouseId: WH, variantId, availableQty: 100, reservedQty: 0 }),
  });
  console.log("Status:", r2.status);
  console.log("Response:", JSON.stringify(await r2.json(), null, 2));

  // Attempt 3: PUT /inventory/stock with initialQty
  console.log("\n=== ATTEMPT 3: PUT /inventory/stock/adjust with newAvailableQty (maybe creates?) ===");
  const r3 = await fetch(`${API}/inventory/stock/adjust`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ warehouseId: WH, variantId, newAvailableQty: 100, reason: "init", createIfMissing: true }),
  });
  console.log("Status:", r3.status);
  console.log("Response:", JSON.stringify(await r3.json(), null, 2));

  // Attempt 4: POST /inventory
  console.log("\n=== ATTEMPT 4: POST /inventory ===");
  const r4 = await fetch(`${API}/inventory`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ warehouseId: WH, variantId, availableQty: 100, reservedQty: 0 }),
  });
  console.log("Status:", r4.status);
  console.log("Response:", JSON.stringify(await r4.json(), null, 2));

  // Attempt 5: PUT /inventory/stock (not /adjust)
  console.log("\n=== ATTEMPT 5: PUT /inventory/stock ===");
  const r5 = await fetch(`${API}/inventory/stock`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ warehouseId: WH, variantId, availableQty: 100 }),
  });
  console.log("Status:", r5.status);
  console.log("Response:", JSON.stringify(await r5.json(), null, 2));
}

main().catch(e => console.error("Fatal:", e));
