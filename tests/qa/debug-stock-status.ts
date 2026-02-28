// tests/qa/debug-stock-status.ts

const API = "http://localhost:3000/api/v1";
const WH = "00000000-0000-0000-0000-000000000010";

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const { accessToken: token } = await loginRes.json();

  // Get full stock listing
  const stockRes = await fetch(`${API}/inventory/stock`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const stockData = await stockRes.json();
  const allStock = stockData.data || stockData;
  
  console.log("=== All stock entries ===");
  for (const s of allStock) {
    const free = s.availableQty - s.reservedQty;
    console.log(`  ${s.sku}: available=${s.availableQty}, reserved=${s.reservedQty}, free=${free}${free <= 0 ? ' ⚠️ EXHAUSTED' : ''}`);
  }

  // Get first variant from catalog (same as getFirstVariant)
  const agentLogin = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "agent1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const agent = await agentLogin.json();
  
  const catRes = await fetch(`${API}/catalog/products`, {
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const catalog = await catRes.json();
  const firstProduct = (catalog.data || catalog)[0];
  const firstVariant = firstProduct?.variants?.[0];
  console.log("\n=== getFirstVariant() returns ===");
  console.log(`  Product: ${firstProduct?.name?.en || firstProduct?.name}`);
  console.log(`  Variant ID: ${firstVariant?.id}`);
  console.log(`  SKU: ${firstVariant?.sku}`);

  // Find its stock
  const matchingStock = allStock.find((s: any) => s.variantId === firstVariant?.id);
  if (matchingStock) {
    console.log(`  Stock: available=${matchingStock.availableQty}, reserved=${matchingStock.reservedQty}`);
  } else {
    console.log("  ⚠️ NO STOCK ROW for this variant!");
  }

  // Try resetting and re-checking
  console.log("\n=== Resetting stock to 1000 ===");
  const resetRes = await fetch(`${API}/inventory/stock/adjust`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ warehouseId: WH, variantId: firstVariant?.id, newAvailableQty: 1000, reason: "debug" }),
  });
  console.log("Status:", resetRes.status);
  const resetBody = await resetRes.json();
  console.log("Response:", JSON.stringify(resetBody));
}

main().catch(e => console.error("Fatal:", e));
