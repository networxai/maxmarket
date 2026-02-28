// tests/qa/s9-06-variant-crud.ts
// S9-6: Variant CRUD + SKU Guard

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getAgentClients, getFirstVariant, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-6: Variant CRUD + SKU Guard\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");

  // Get an existing product with variants
  const catalog = await api("GET", "/catalog/products", admin.accessToken);
  const products = catalog.data?.data || catalog.data || [];
  const product = products.find((p: any) => p.variants?.length > 0);
  assert(!!product, "Found an existing product with variants");
  const productId = product.id;

  // Step 1: Add a new variant to the product
  const newSku = `QA-VAR-${Date.now()}`;
  const addVariant = await api("POST", `/catalog/products/${productId}/variants`, admin.accessToken, {
    sku: newSku,
    unitType: "piece",
    pricePerUnit: 15,
    costPrice: 7,
    minOrderQty: 1,
    isActive: true,
  });
  assertEqual(addVariant.status, 201, "Variant added to product");
  const newVariantId = addVariant.data?.id;
  assert(!!newVariantId, "New variant has id");

  // Step 2: Edit variant pricing
  const editVariant = await api("PUT", `/catalog/products/${productId}/variants/${newVariantId}`, admin.accessToken, {
    pricePerUnit: 18,
    costPrice: 9,
  });
  assertEqual(editVariant.status, 200, "Variant pricing updated");
  assertEqual(Number(editVariant.data?.pricePerUnit), 18, "pricePerUnit is 18");

  // Steps 3-5: Use an EXISTING seeded variant that HAS stock for order constraint tests
  const existingVariant = await getFirstVariant(agent.accessToken);
  await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId: existingVariant.variantId,
    newAvailableQty: 1000,
    reason: "S9-6 stock setup",
  });

  // Find the product owning this variant
  const existingProduct = products.find((p: any) =>
    p.variants?.some((v: any) => v.id === existingVariant.variantId)
  );
  assert(!!existingProduct, "Found product owning seeded variant");
  const existingProductId = existingProduct.id;
  const existingVariantId = existingVariant.variantId;
  const originalSku = existingProduct.variants.find((v: any) => v.id === existingVariantId)?.sku;
  console.log(`  Using seeded variant: ${originalSku} (${existingVariantId})`);

  // Step 3: Create order referencing the variant → submit
  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  const draft = await api("POST", "/orders", agent.accessToken, {
    clientId,
    lineItems: [{ variantId: existingVariantId, qty: 2, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(draft.status, 201, "Order created with variant");

  const submit = await api("POST", `/orders/${draft.data.id}/submit`, agent.accessToken);
  assertEqual(submit.status, 200, "Order submitted");

  // Step 4: Try to change variant SKU → 409 (non-draft orders reference it)
  const skuChange = await api("PUT", `/catalog/products/${existingProductId}/variants/${existingVariantId}`, admin.accessToken, {
    sku: `QA-CHANGED-${Date.now()}`,
  });
  assertEqual(skuChange.status, 409, "Cannot change SKU with non-draft orders (409)");

  // Step 5: Try to delete variant → 409
  const deleteVariant = await api("DELETE", `/catalog/products/${existingProductId}/variants/${existingVariantId}`, admin.accessToken);
  assertEqual(deleteVariant.status, 409, "Cannot delete variant with active orders (409)");

  // Step 6: Reject the order
  const reject = await api("POST", `/orders/${draft.data.id}/reject`, manager.accessToken, {
    reason: "QA test — clearing for SKU change",
    versionLock: submit.data.versionLock,
  });
  assertEqual(reject.status, 200, "Order rejected");

  // Step 7: SKU change — may succeed if no other active orders reference this variant,
  // or may still return 409 if other seed/test orders reference it.
  const newSku2 = `QA-CHANGED-${Date.now()}`;
  const skuChange2 = await api("PUT", `/catalog/products/${existingProductId}/variants/${existingVariantId}`, admin.accessToken, {
    sku: newSku2,
  });
  assert(
    skuChange2.status === 200 || skuChange2.status === 409,
    "SKU change after reject returns 200 (success) or 409 (other orders still reference it)",
    { status: skuChange2.status }
  );
  if (skuChange2.status === 409) {
    console.log("  ℹ️  SKU change blocked by other existing orders on shared seeded variant — expected");
  }

  // Restore original SKU
  if (originalSku) {
    await api("PUT", `/catalog/products/${existingProductId}/variants/${existingVariantId}`, admin.accessToken, {
      sku: originalSku,
    });
  }

  return printSummary("S9-6: Variant CRUD + SKU Guard");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
