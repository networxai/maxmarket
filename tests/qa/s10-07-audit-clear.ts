// tests/qa/s10-07-audit-clear.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs } from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S10-7: Audit Log Clear\n");

  const sa = await loginAs("super_admin");
  const admin = await loginAs("admin");
  const manager = await loginAs("manager");

  // Step 1: Super admin clears far past (may clear 0)
  const clear1 = await api("POST", "/audit/logs/clear", sa.accessToken, {
    scope: "before_date",
    beforeDate: "2020-01-01T00:00:00Z",
  });
  assertEqual(clear1.status, 200, "Super admin: clear returns 200");
  assert(clear1.data?.clearedCount !== undefined, "Response has clearedCount");
  console.log(`  Cleared (far past): ${clear1.data.clearedCount} entries`);

  // Step 2: Perform action to create a fresh audit entry
  const createUser = await api("POST", "/users", sa.accessToken, {
    email: `qa-audit-${Date.now()}@maxmarket.com`,
    password: "ChangeMe1!",
    fullName: "Audit Test User",
    role: "agent",
  });
  assertEqual(createUser.status, 201, "Created user to generate audit entry");

  // Step 3: Clear with beforeDate = 1 second ago
  const now = new Date();
  const oneSecAgo = new Date(now.getTime() - 1000).toISOString();
  const clear2 = await api("POST", "/audit/logs/clear", sa.accessToken, {
    scope: "before_date",
    beforeDate: oneSecAgo,
  });
  assertEqual(clear2.status, 200, "Clear with recent beforeDate returns 200");
  console.log(`  Cleared (recent): ${clear2.data?.clearedCount} entries`);

  // Step 4: Verify clearing event is visible
  const logsAfter = await api("GET", "/audit/logs", sa.accessToken);
  assertEqual(logsAfter.status, 200, "GET /audit/logs after clear returns 200");
  const entries = logsAfter.data?.data || logsAfter.data || [];
  assert(entries.length > 0, "Audit log still has entries after clear (clearing event itself)");

  // Step 5: includeCleared shows cleared entries
  const inclCleared = await api("GET", "/audit/logs?includeCleared=true", sa.accessToken);
  assertEqual(inclCleared.status, 200, "includeCleared=true returns 200");
  const allEntries = inclCleared.data?.data || inclCleared.data || [];
  assert(allEntries.length >= entries.length, "includeCleared shows >= default entries");

  // Step 6: Admin → 403
  const adminClear = await api("POST", "/audit/logs/clear", admin.accessToken, {
    scope: "before_date",
    beforeDate: "2020-01-01T00:00:00Z",
  });
  assertEqual(adminClear.status, 403, "Admin: clear returns 403");

  // Step 7: Manager → 403
  const managerClear = await api("POST", "/audit/logs/clear", manager.accessToken, {
    scope: "before_date",
    beforeDate: "2020-01-01T00:00:00Z",
  });
  assertEqual(managerClear.status, 403, "Manager: clear returns 403");

  return printSummary("S10-7: Audit Log Clear");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
