// tests/qa/s9-07-category-crud.ts
// S9-7: Category CRUD + Constraint

import {
  api, assert, assertEqual, resetCounters, printSummary, loginAs,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-7: Category CRUD + Constraint\n");

  const admin = await loginAs("admin");

  // Step 1: Create category
  const catName = `QA Category ${Date.now()}`;
  const createCat = await api("POST", "/catalog/categories", admin.accessToken, {
    name: { en: catName },
  });
  assertEqual(createCat.status, 201, "Admin creates category");
  const catId = createCat.data?.id;
  assert(!!catId, "Category has id");

  // Step 2: Verify in list
  const catList = await api("GET", "/catalog/categories", admin.accessToken);
  assertEqual(catList.status, 200, "GET /catalog/categories returns 200");
  const categories = catList.data?.data || catList.data || [];
  const found = categories.find((c: any) => c.id === catId);
  assert(!!found, "New category appears in list");

  // Step 3: Create product in that category
  const createProduct = await api("POST", "/catalog/products", admin.accessToken, {
    name: { en: `QA Cat Product ${Date.now()}` },
    description: { en: "Product for category constraint test" },
    categoryId: catId,
    variants: [{
      sku: `QA-CAT-${Date.now()}`,
      unitType: "piece",
      pricePerUnit: 10,
      costPrice: 5,
      minOrderQty: 1,
      isActive: true,
    }],
  });
  assertEqual(createProduct.status, 201, "Product created in new category");
  const productId = createProduct.data?.id;

  // Step 4: Try to delete category → 409 (products assigned)
  const deleteBlocked = await api("DELETE", `/catalog/categories/${catId}`, admin.accessToken);
  assertEqual(deleteBlocked.status, 409, "Cannot delete category with products (409)");

  // Step 5: Move product to different category
  const otherCat = categories.find((c: any) => c.id !== catId);
  assert(!!otherCat, "Found another category to move product to");

  const moveProduct = await api("PUT", `/catalog/products/${productId}`, admin.accessToken, {
    categoryId: otherCat.id,
  });
  assertEqual(moveProduct.status, 200, "Product moved to different category");

  // Step 6: Delete original category → success
  const deleteOk = await api("DELETE", `/catalog/categories/${catId}`, admin.accessToken);
  assert(
    deleteOk.status === 200 || deleteOk.status === 204,
    "Delete empty category succeeds",
    { status: deleteOk.status }
  );

  return printSummary("S9-7: Category CRUD + Constraint");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
