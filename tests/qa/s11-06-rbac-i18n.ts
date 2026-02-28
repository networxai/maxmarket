// tests/qa/s11-06-rbac-i18n.ts
import { api, assert, login, resetCounters, loginAs } from "./helpers.ts";

const API = "http://localhost:3000/api/v1";

async function main() {
  resetCounters();
  console.log("\n🔄 S11-6: RBAC for I18n\n");

  const tokens: Record<string, string> = {};
  const roles = ["super_admin", "admin", "manager", "agent", "client"];
  const emails: Record<string, string> = {
    super_admin: "super_admin@maxmarket.com",
    admin: "admin1@maxmarket.com",
    manager: "manager1@maxmarket.com",
    agent: "agent1@maxmarket.com",
    client: "client1@maxmarket.com",
  };

  for (const role of roles) {
    const res = await login(emails[role]);
    tokens[role] = res.accessToken;
  }

  const results: { endpoint: string; role: string; expected: string; actual: number; pass: boolean }[] = [];

  // GET /i18n/ui-strings — all roles + public
  console.log("\n  📋 GET /i18n/ui-strings?language=en");
  for (const role of roles) {
    const res = await api("GET", "/i18n/ui-strings?language=en", tokens[role]);
    const pass = res.status === 200;
    results.push({ endpoint: "GET ui-strings", role, expected: "200", actual: res.status, pass });
    console.log(pass ? `    ✅ ${role}: 200` : `    ❌ ${role}: ${res.status}`);
  }

  // Public (no auth)
  const pubRes = await fetch(`${API}/i18n/ui-strings?language=en`);
  const pubPass = pubRes.status === 200;
  results.push({ endpoint: "GET ui-strings", role: "public", expected: "200", actual: pubRes.status, pass: pubPass });
  console.log(pubPass ? `    ✅ public: 200` : `    ❌ public: ${pubRes.status}`);

  // PUT /i18n/ui-strings — only super_admin
  console.log("\n  📋 PUT /i18n/ui-strings");
  const putBody = { language: "en", strings: { "test.rbac": "test" } };

  // super_admin → 200
  const saPut = await api("PUT", "/i18n/ui-strings", tokens.super_admin, putBody);
  const saPass = saPut.status === 200;
  results.push({ endpoint: "PUT ui-strings", role: "super_admin", expected: "200", actual: saPut.status, pass: saPass });
  console.log(saPass ? `    ✅ super_admin: 200` : `    ❌ super_admin: ${saPut.status}`);

  // Others → 403
  for (const role of ["admin", "manager", "agent", "client"]) {
    const res = await api("PUT", "/i18n/ui-strings", tokens[role], putBody);
    const pass = res.status === 403;
    results.push({ endpoint: "PUT ui-strings", role, expected: "403", actual: res.status, pass });
    console.log(pass ? `    ✅ ${role}: 403` : `    ❌ ${role}: ${res.status}`);
  }

  // Public (no auth) → 401
  const pubPut = await fetch(`${API}/i18n/ui-strings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(putBody),
  });
  const pubPutPass = pubPut.status === 401;
  results.push({ endpoint: "PUT ui-strings", role: "public", expected: "401", actual: pubPut.status, pass: pubPutPass });
  console.log(pubPutPass ? `    ✅ public: 401` : `    ❌ public: ${pubPut.status}`);

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  S11-6 RBAC I18n Matrix`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Total: ${results.length}  |  Passed: ${passed}  |  Failed: ${failed}`);
  if (failed > 0) {
    console.log(`\n  Failures:`);
    results.filter(r => !r.pass).forEach(r => {
      console.log(`    - ${r.endpoint} as ${r.role}: expected ${r.expected}, got ${r.actual}`);
    });
  }
  console.log(`${"=".repeat(60)}\n`);
  return failed === 0;
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
