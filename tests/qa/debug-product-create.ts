// tests/qa/debug-product-create.ts

const API = "http://localhost:3000/api/v1";

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const { accessToken: token } = await loginRes.json();

  // Get categories
  const catRes = await fetch(`${API}/catalog/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cats = await catRes.json();
  const categoryId = (cats.data || cats)[0]?.id;
  console.log("Category ID:", categoryId);

  // Look at an existing product for schema reference
  const prodRes = await fetch(`${API}/catalog/products`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const prods = await prodRes.json();
  const sample = (prods.data || prods)[0];
  console.log("\n=== Sample existing product ===");
  console.log(JSON.stringify(sample, null, 2).slice(0, 2000));

  // Attempt 1: Schema from test
  console.log("\n\n=== ATTEMPT 1: { name, description, categoryId, variants: [...] } ===");
  const r1 = await fetch(`${API}/catalog/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "QA Test Product",
      description: "Test",
      categoryId,
      variants: [{
        sku: `QA-DBG-${Date.now()}`,
        unitType: "piece",
        pricePerUnit: 25,
        costPrice: 10,
        minOrderQty: 1,
        isActive: true,
      }],
    }),
  });
  console.log("Status:", r1.status);
  console.log("Response:", JSON.stringify(await r1.json(), null, 2));

  // Attempt 2: Without variants (product only)
  console.log("\n\n=== ATTEMPT 2: { name, description, categoryId } (no variants) ===");
  const r2 = await fetch(`${API}/catalog/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "QA Test Product 2",
      description: "Test 2",
      categoryId,
    }),
  });
  console.log("Status:", r2.status);
  console.log("Response:", JSON.stringify(await r2.json(), null, 2));

  // Attempt 3: With isActive
  console.log("\n\n=== ATTEMPT 3: { name, description, categoryId, isActive } ===");
  const r3 = await fetch(`${API}/catalog/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "QA Test Product 3",
      description: "Test 3",
      categoryId,
      isActive: true,
    }),
  });
  console.log("Status:", r3.status);
  console.log("Response:", JSON.stringify(await r3.json(), null, 2));

  // Attempt 4: Minimal
  console.log("\n\n=== ATTEMPT 4: { name, categoryId } ===");
  const r4 = await fetch(`${API}/catalog/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: "QA Test Product 4",
      categoryId,
    }),
  });
  console.log("Status:", r4.status);
  console.log("Response:", JSON.stringify(await r4.json(), null, 2));
}

main().catch(e => console.error("Fatal:", e));
