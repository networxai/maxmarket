// tests/qa/s10-10-regression.ts
import {
  api, assert, assertEqual, resetCounters, printSummary,
  loginAs, WAREHOUSE_ID,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S10-10: Phase 9 Regression\n");

  const sa = await loginAs("super_admin");
  const admin = await loginAs("admin");

  // Step 1: User CRUD
  const userEmail = `qa-reg10-${Date.now()}@maxmarket.com`;
  const createUser = await api("POST", "/users", sa.accessToken, {
    email: userEmail,
    password: "ChangeMe1!",
    fullName: "Reg Test User",
    role: "agent",
  });
  assertEqual(createUser.status, 201, "Create user works");
  const userId = createUser.data?.id;

  const editUser = await api("PUT", `/users/${userId}`, sa.accessToken, {
    fullName: "Reg Test Updated",
  });
  assertEqual(editUser.status, 200, "Edit user works");

  const deactivate = await api("PUT", `/users/${userId}`, sa.accessToken, {
    isActive: false,
  });
  assertEqual(deactivate.status, 200, "Deactivate user works");
  assertEqual(deactivate.data?.isActive, false, "User is deactivated");

  // Step 2: Client Group CRUD
  const groupName = `Reg Group ${Date.now()}`;
  const createGroup = await api("POST", "/client-groups", admin.accessToken, {
    name: groupName,
    discountType: "percentage",
    discountValue: 10,
  });
  assertEqual(createGroup.status, 201, "Create client group works");
  const groupId = createGroup.data?.id;

  const deleteGroup = await api("DELETE", `/client-groups/${groupId}`, admin.accessToken);
  assert(deleteGroup.status === 200 || deleteGroup.status === 204, "Delete client group works", { status: deleteGroup.status });

  // Step 3: Stock adjust
  const stockList = await api("GET", "/inventory/stock", admin.accessToken);
  const stockEntry = (stockList.data?.data || stockList.data || [])[0];
  if (stockEntry) {
    const adjust = await api("PUT", "/inventory/stock/adjust", admin.accessToken, {
      warehouseId: WAREHOUSE_ID,
      variantId: stockEntry.variantId,
      newAvailableQty: stockEntry.availableQty,
      reason: "Regression test — no-op adjust",
    });
    assertEqual(adjust.status, 200, "Stock adjust works");
  }

  // Step 4: Product create with variant → stock row exists (DL-17)
  const catList = await api("GET", "/catalog/categories", admin.accessToken);
  const categoryId = (catList.data?.data || catList.data || [])[0]?.id;

  const createProd = await api("POST", "/catalog/products", admin.accessToken, {
    name: { en: `Reg Product ${Date.now()}` },
    description: { en: "Regression test" },
    categoryId,
    variants: [{
      sku: `REG-${Date.now()}`,
      unitType: "piece",
      pricePerUnit: 10,
      costPrice: 5,
      minOrderQty: 1,
      isActive: true,
    }],
  });
  assertEqual(createProd.status, 201, "Product creation works");
  const newVariantId = createProd.data?.variants?.[0]?.id;

  if (newVariantId) {
    const stockCheck = await api("GET", `/inventory/stock?variantId=${newVariantId}`, admin.accessToken);
    const stockRows = stockCheck.data?.data || stockCheck.data || [];
    assert(stockRows.length > 0, "DL-17: Stock row auto-created for new variant");
  }

  return printSummary("S10-10: Phase 9 Regression");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
