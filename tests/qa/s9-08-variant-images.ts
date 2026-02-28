// tests/qa/s9-08-variant-images.ts
// S9-8: Variant Images

import {
  api, assert, assertEqual, resetCounters, printSummary, loginAs,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-8: Variant Images\n");

  const admin = await loginAs("admin");

  // Get an existing product with a variant
  const catalog = await api("GET", "/catalog/products", admin.accessToken);
  const products = catalog.data?.data || catalog.data || [];
  const product = products.find((p: any) => p.variants?.length > 0);
  assert(!!product, "Found a product with variants");
  const productId = product.id;
  const variantId = product.variants[0].id;

  // Step 1: Add image to variant
  const addImage1 = await api("POST", `/catalog/products/${productId}/variants/${variantId}/images`, admin.accessToken, {
    url: "https://example.com/qa-image-1.jpg",
    altText: "QA Image 1",
    sortOrder: 0,
  });
  assertEqual(addImage1.status, 201, "First image added");
  const image1Id = addImage1.data?.id;
  assert(!!image1Id, "Image 1 has id");

  // Step 2: Verify image in variant response
  const variantRes = await api("GET", `/catalog/products/${productId}`, admin.accessToken);
  const variantData = variantRes.data?.variants?.find((v: any) => v.id === variantId);
  const images = variantData?.images || [];
  assert(images.length >= 1, "Variant has at least 1 image");

  // Step 3: Add second image
  const addImage2 = await api("POST", `/catalog/products/${productId}/variants/${variantId}/images`, admin.accessToken, {
    url: "https://example.com/qa-image-2.jpg",
    altText: "QA Image 2",
    sortOrder: 1,
  });
  assertEqual(addImage2.status, 201, "Second image added");
  const image2Id = addImage2.data?.id;

  // Step 4: Verify sort order
  const variantRes2 = await api("GET", `/catalog/products/${productId}`, admin.accessToken);
  const variantData2 = variantRes2.data?.variants?.find((v: any) => v.id === variantId);
  const images2 = variantData2?.images || [];
  assert(images2.length >= 2, "Variant has at least 2 images");
  if (images2.length >= 2) {
    assert(
      (images2[0].sortOrder ?? 0) <= (images2[1].sortOrder ?? 1),
      "Images are in sort order"
    );
  }

  // Step 5: Reorder images (swap order)
  const reorder = await api("PUT", `/catalog/products/${productId}/variants/${variantId}/images/reorder`, admin.accessToken, {
    imageIds: [image2Id, image1Id],
  });
  assert(
    reorder.status === 200 || reorder.status === 204,
    "Reorder images succeeds",
    { status: reorder.status }
  );

  // Step 6: Reorder with invalid image ID → 422
  const badReorder = await api("PUT", `/catalog/products/${productId}/variants/${variantId}/images/reorder`, admin.accessToken, {
    imageIds: ["00000000-0000-0000-0000-000000000000", image1Id],
  });
  assertEqual(badReorder.status, 422, "Reorder with invalid image ID returns 422");

  // Step 7: Delete an image
  const deleteImg = await api("DELETE", `/catalog/products/${productId}/variants/${variantId}/images/${image1Id}`, admin.accessToken);
  assert(
    deleteImg.status === 200 || deleteImg.status === 204,
    "Delete image succeeds",
    { status: deleteImg.status }
  );

  // Step 8: Verify only 1 QA image remains
  const variantRes3 = await api("GET", `/catalog/products/${productId}`, admin.accessToken);
  const variantData3 = variantRes3.data?.variants?.find((v: any) => v.id === variantId);
  const images3 = (variantData3?.images || []).filter((i: any) =>
    i.url?.includes("qa-image")
  );
  assertEqual(images3.length, 1, "Only 1 QA image remains after delete");

  // Cleanup: delete remaining QA image
  if (image2Id) {
    await api("DELETE", `/catalog/products/${productId}/variants/${variantId}/images/${image2Id}`, admin.accessToken);
  }

  return printSummary("S9-8: Variant Images");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
