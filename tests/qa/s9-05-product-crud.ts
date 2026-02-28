// tests/qa/s9-05-product-crud.ts
// S9-5: Product CRUD + Constraints

import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, getAgentClients, getFirstVariant, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-5: Product CRUD + Constraints\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const manager = await loginAs("manager");

  // Get a category
  const catList = await api("GET", "/catalog/categories", admin.accessToken);
  const categories = catList.data?.data || catList.data || [];
  const categoryId = categories[0]?.id;
  assert(!!categoryId, "Found a category for product creation");

  // Step 1: Create product with one variant (CRUD test — no orders on this one)
  const productName = `QA Product ${Date.now()}`;
  const sku = `QA-SKU-${Date.now()}`;
  const createProduct = await api("POST", "/catalog/products", admin.accessToken, {
    name: { en: productName },
    description: { en: "QA test product" },
    categoryId,
    variants: [{
      sku,
      unitType: "piece",
      pricePerUnit: 25,
      costPrice: 10,
      minOrderQty: 1,
      isActive: true,
    }],
  });
  assertEqual(createProduct.status, 201, "Admin creates product");
  const productId = createProduct.data?.id;
  assert(!!productId, "Product has id");

  // Step 2: Verify in catalog
  const catalog = await api("GET", "/catalog/products", admin.accessToken);
  const products = catalog.data?.data || catalog.data || [];
  const found = products.find((p: any) => p.id === productId);
  assert(!!found, "New product appears in catalog");

  // Step 3: Edit product name
  const newName = `QA Product Updated ${Date.now()}`;
  const editProduct = await api("PUT", `/catalog/products/${productId}`, admin.accessToken, {
    name: { en: newName },
  });
  assertEqual(editProduct.status, 200, "Edit product returns 200");
  const editedName = editProduct.data?.name?.en || editProduct.data?.name;
  assertEqual(editedName, newName, "Product name updated");

  // Step 4: Test delete constraint using EXISTING seeded product with stock
  const existingVariant = await getFirstVariant(agent.accessToken);
  await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
    warehouseId: WAREHOUSE_ID,
    variantId: existingVariant.variantId,
    newAvailableQty: 1000,
    reason: "S9-5 stock setup",
  });

  // Find the product that owns this variant
  const allProducts = catalog.data?.data || catalog.data || [];
  const existingProduct = allProducts.find((p: any) =>
    p.variants?.some((v: any) => v.id === existingVariant.variantId)
  );
  assert(!!existingProduct, "Found product owning the existing variant");

  const clients = await getAgentClients(agent.user.id, agent.accessToken);
  const clientId = clients[0].id || clients[0].clientId;

  const draft = await api("POST", "/orders", agent.accessToken, {
    clientId,
    lineItems: [{ variantId: existingVariant.variantId, qty: 2, warehouseId: WAREHOUSE_ID }],
  });
  assertEqual(draft.status, 201, "Order created for existing product");

  const submit = await api("POST", `/orders/${draft.data.id}/submit`, agent.accessToken);
  assertEqual(submit.status, 200, "Order submitted");

  const approve = await api("POST", `/orders/${draft.data.id}/approve`, manager.accessToken, {
    versionLock: submit.data.versionLock,
  });
  assertEqual(approve.status, 200, "Order approved");

  // Step 5: Try to delete product with active order → 409
  const deleteBlocked = await api("DELETE", `/catalog/products/${existingProduct.id}`, admin.accessToken);
  assertEqual(deleteBlocked.status, 409, "Cannot delete product with active orders (409)");

  // Step 6: Cancel the order, try delete again
  const cancel = await api("POST", `/orders/${draft.data.id}/cancel`, manager.accessToken);
  assertEqual(cancel.status, 200, "Order cancelled");

  const deleteAfterCancel = await api("DELETE", `/catalog/products/${existingProduct.id}`, admin.accessToken);
  console.log(`  Delete after cancel: ${deleteAfterCancel.status} (check DL-08)`);
  assert(
    deleteAfterCancel.status === 200 || deleteAfterCancel.status === 204 || deleteAfterCancel.status === 409,
    "Delete after cancel returns 200/204 or 409 per DL-08",
    { status: deleteAfterCancel.status }
  );

  // Step 7: Agent cannot create products
  const agentCreate = await api("POST", "/catalog/products", agent.accessToken, {
    name: { en: "Agent Product Attempt" },
    description: { en: "Should fail" },
    categoryId,
    variants: [{ sku: "FAIL-SKU", unitType: "piece", pricePerUnit: 1, costPrice: 1, minOrderQty: 1 }],
  });
  assertEqual(agentCreate.status, 403, "Agent cannot create products (403)");

  // Cleanup: delete the QA product (no orders reference it)
  await api("DELETE", `/catalog/products/${productId}`, admin.accessToken);

  return printSummary("S9-5: Product CRUD + Constraints");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
