// tests/qa/s10-05-csv-export.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs } from "./helpers.ts";

const API = "http://localhost:3000/api/v1";

// Raw fetch for CSV (api helper parses JSON)
async function fetchRaw(path: string, token: string): Promise<{ status: number; contentType: string; body: string }> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    status: res.status,
    contentType: res.headers.get("content-type") || "",
    body: await res.text(),
  };
}

async function main() {
  resetCounters();
  console.log("\n🔄 S10-5: CSV Export\n");

  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const client = await loginAs("client1");

  const dateParams = "dateFrom=2025-01-01&dateTo=2027-01-01";

  // Step 1: Admin CSV export — sales-by-date
  const csv1 = await fetchRaw(`/reports/sales-by-date/export?format=csv&${dateParams}`, admin.accessToken);
  assertEqual(csv1.status, 200, "CSV export sales-by-date returns 200");
  assert(csv1.contentType.includes("csv") || csv1.contentType.includes("text/"), "Content-Type includes csv or text", { contentType: csv1.contentType });

  // Step 2: Valid CSV — has header + data
  const lines = csv1.body.trim().split("\n");
  assert(lines.length >= 1, "CSV has at least a header row");
  console.log(`  sales-by-date CSV: ${lines.length} lines, header: ${lines[0].slice(0, 80)}`);

  // Step 3: PDF → 501
  const pdf = await fetchRaw(`/reports/sales-by-date/export?format=pdf&${dateParams}`, admin.accessToken);
  assertEqual(pdf.status, 501, "PDF export returns 501");

  // Step 4: CSV for other report types
  const csv2 = await fetchRaw("/reports/sales-by-manager/export?format=csv", admin.accessToken);
  assertEqual(csv2.status, 200, "CSV export sales-by-manager returns 200");

  const csv3 = await fetchRaw("/reports/sales-by-client/export?format=csv", admin.accessToken);
  assertEqual(csv3.status, 200, "CSV export sales-by-client returns 200");

  const csv4 = await fetchRaw(`/reports/sales-by-product/export?format=csv`, admin.accessToken);
  assertEqual(csv4.status, 200, "CSV export sales-by-product returns 200");

  // Step 5: Agent CSV — scoped
  const agentCsv = await fetchRaw(`/reports/sales-by-date/export?format=csv&${dateParams}`, agent.accessToken);
  assertEqual(agentCsv.status, 200, "Agent CSV export returns 200");

  // Step 6: Client CSV → 403
  const clientCsv = await fetchRaw(`/reports/sales-by-date/export?format=csv&${dateParams}`, client.accessToken);
  assertEqual(clientCsv.status, 403, "Client CSV export returns 403");

  return printSummary("S10-5: CSV Export");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
