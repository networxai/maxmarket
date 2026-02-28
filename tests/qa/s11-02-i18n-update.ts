// tests/qa/s11-02-i18n-update.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs } from "./helpers.ts";

const API = "http://localhost:3000/api/v1";

async function getStrings(language: string): Promise<any> {
  const res = await fetch(`${API}/i18n/ui-strings?language=${language}`);
  return res.json();
}

async function main() {
  resetCounters();
  console.log("\n🔄 S11-2: I18n String Update\n");

  const sa = await loginAs("super_admin");
  const admin = await loginAs("admin");
  const agent = await loginAs("agent1");
  const client = await loginAs("client1");

  // Step 1: Super admin creates new key
  const put1 = await api("PUT", "/i18n/ui-strings", sa.accessToken, {
    language: "en",
    strings: { "test.qa.key": "QA Test Value" },
  });
  assertEqual(put1.status, 200, "Super admin: PUT ui-strings returns 200");

  // Step 2: Verify new key
  const after1 = await getStrings("en");
  const strings1 = after1.data || after1;
  const qaKey = strings1["test.qa.key"] ?? strings1.test?.qa?.key;
  assertEqual(qaKey, "QA Test Value", "test.qa.key = 'QA Test Value'");

  // Step 3: Note original nav.home value
  const origNavHome = strings1["nav.home"] ?? strings1.nav?.home;
  console.log(`  Original nav.home: "${origNavHome}"`);

  // Step 4: Update existing key
  const put2 = await api("PUT", "/i18n/ui-strings", sa.accessToken, {
    language: "en",
    strings: { "nav.home": "Home Page" },
  });
  assertEqual(put2.status, 200, "Update existing key returns 200");

  // Step 5: Verify updated
  const after2 = await getStrings("en");
  const strings2 = after2.data || after2;
  const updatedHome = strings2["nav.home"] ?? strings2.nav?.home;
  assertEqual(updatedHome, "Home Page", "nav.home updated to 'Home Page'");

  // Step 6: Verify other keys still exist (upsert, not replace)
  const qaKeyStill = strings2["test.qa.key"] ?? strings2.test?.qa?.key;
  assertEqual(qaKeyStill, "QA Test Value", "Other keys still exist after upsert");

  // Step 7: Restore
  const restore = await api("PUT", "/i18n/ui-strings", sa.accessToken, {
    language: "en",
    strings: { "nav.home": origNavHome || "Home" },
  });
  assertEqual(restore.status, 200, "Restore nav.home returns 200");

  // Step 8: Admin → 403
  const adminPut = await api("PUT", "/i18n/ui-strings", admin.accessToken, {
    language: "en",
    strings: { "test.key": "fail" },
  });
  assertEqual(adminPut.status, 403, "Admin: PUT ui-strings returns 403");

  // Step 9: Agent → 403
  const agentPut = await api("PUT", "/i18n/ui-strings", agent.accessToken, {
    language: "en",
    strings: { "test.key": "fail" },
  });
  assertEqual(agentPut.status, 403, "Agent: PUT ui-strings returns 403");

  // Step 10: Client → 403
  const clientPut = await api("PUT", "/i18n/ui-strings", client.accessToken, {
    language: "en",
    strings: { "test.key": "fail" },
  });
  assertEqual(clientPut.status, 403, "Client: PUT ui-strings returns 403");

  return printSummary("S11-2: I18n String Update");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
