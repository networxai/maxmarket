// tests/qa/s11-01-i18n-fetch.ts
import { api, assert, assertEqual, resetCounters, printSummary } from "./helpers.ts";

const API = "http://localhost:3000/api/v1";

async function fetchPublic(path: string): Promise<{ status: number; data: any }> {
  const res = await fetch(`${API}${path}`);
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data };
}

async function main() {
  resetCounters();
  console.log("\n🔄 S11-1: I18n String Fetch\n");

  // Step 1: English strings (no auth)
  const en = await fetchPublic("/i18n/ui-strings?language=en");
  assertEqual(en.status, 200, "GET ui-strings?language=en returns 200");
  const strings = en.data?.data || en.data || {};
  assert(typeof strings === "object", "Response is object");

  // Step 2-3: Check specific keys
  const navHome = strings["nav.home"] ?? strings.nav?.home;
  assert(navHome !== undefined, "Key nav.home exists", { value: navHome });

  const draftStatus = strings["orders.status.draft"] ?? strings.orders?.status?.draft;
  assert(draftStatus !== undefined, "Key orders.status.draft exists", { value: draftStatus });

  // Step 4: Armenian
  const hy = await fetchPublic("/i18n/ui-strings?language=hy");
  assertEqual(hy.status, 200, "GET ui-strings?language=hy returns 200");

  // Step 5: Russian
  const ru = await fetchPublic("/i18n/ui-strings?language=ru");
  assertEqual(ru.status, 200, "GET ui-strings?language=ru returns 200");

  // Step 6: Invalid language → 422
  const fr = await fetchPublic("/i18n/ui-strings?language=fr");
  assertEqual(fr.status, 422, "GET ui-strings?language=fr returns 422 (invalid)");

  // Step 7: No language param
  const noLang = await fetchPublic("/i18n/ui-strings");
  assert(
    noLang.status === 422 || noLang.status === 200,
    "No language param returns 422 or 200 (default)",
    { status: noLang.status }
  );

  return printSummary("S11-1: I18n String Fetch");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
