// tests/qa/debug-warehouse.ts

const API = "http://localhost:3000/api/v1";

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const { accessToken: token } = await loginRes.json();

  // Try common warehouse endpoints
  const endpoints = [
    "/warehouses",
    "/inventory/warehouses",
    "/inventory/stock",
    "/inventory/stock?variantId=6e0487ff-07c2-4d7c-be47-e17f422acfc9",
  ];

  for (const ep of endpoints) {
    console.log(`\n=== GET ${ep} ===`);
    const res = await fetch(`${API}${ep}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("Status:", res.status);
    const body = await res.json().catch(() => null);
    console.log(JSON.stringify(body, null, 2)?.slice(0, 2000));
  }

  // Once we find a warehouseId, try creating an order with it
  // (will be filled in based on results above)
}

main().catch(e => console.error("Fatal:", e));
