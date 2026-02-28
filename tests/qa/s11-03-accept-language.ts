// tests/qa/s11-03-accept-language.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs } from "./helpers.ts";

const API = "http://localhost:3000/api/v1";

async function fetchWithLang(path: string, token: string, lang?: string): Promise<any> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (lang) headers["Accept-Language"] = lang;
  const res = await fetch(`${API}${path}`, { headers });
  return { status: res.status, data: await res.json() };
}

async function main() {
  resetCounters();
  console.log("\n🔄 S11-3: Accept-Language Header\n");

  const admin = await loginAs("admin");

  // Step 1: English
  const en = await fetchWithLang("/catalog/products", admin.accessToken, "en");
  assertEqual(en.status, 200, "Products with Accept-Language: en returns 200");
  const products = en.data?.data || en.data || [];
  assert(products.length > 0, "Has products");
  const enName = products[0]?.name;
  console.log(`  EN product name: ${typeof enName === "object" ? JSON.stringify(enName) : enName}`);

  // Step 2: Armenian
  const hy = await fetchWithLang("/catalog/products", admin.accessToken, "hy");
  assertEqual(hy.status, 200, "Products with Accept-Language: hy returns 200");
  const hyProducts = hy.data?.data || hy.data || [];
  if (hyProducts.length > 0) {
    const hyName = hyProducts[0]?.name;
    console.log(`  HY product name: ${typeof hyName === "object" ? JSON.stringify(hyName) : hyName}`);
  }

  // Step 3: Russian
  const ru = await fetchWithLang("/catalog/products", admin.accessToken, "ru");
  assertEqual(ru.status, 200, "Products with Accept-Language: ru returns 200");
  const ruProducts = ru.data?.data || ru.data || [];
  if (ruProducts.length > 0) {
    const ruName = ruProducts[0]?.name;
    console.log(`  RU product name: ${typeof ruName === "object" ? JSON.stringify(ruName) : ruName}`);
  }

  // Step 4: No Accept-Language → defaults
  const noLang = await fetchWithLang("/catalog/products", admin.accessToken);
  assertEqual(noLang.status, 200, "Products with no Accept-Language returns 200");

  // Step 5: Categories with Accept-Language
  const enCat = await fetchWithLang("/catalog/categories", admin.accessToken, "en");
  assertEqual(enCat.status, 200, "Categories with Accept-Language: en returns 200");
  const categories = enCat.data?.data || enCat.data || [];
  if (categories.length > 0) {
    const catName = categories[0]?.name;
    console.log(`  EN category name: ${typeof catName === "object" ? JSON.stringify(catName) : catName}`);
  }

  const hyCat = await fetchWithLang("/catalog/categories", admin.accessToken, "hy");
  assertEqual(hyCat.status, 200, "Categories with Accept-Language: hy returns 200");

  return printSummary("S11-3: Accept-Language Header");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
