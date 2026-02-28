// tests/qa/s11-04-profile-edit.ts
import { api, assert, assertEqual, resetCounters, printSummary, loginAs } from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S11-4: User Profile Edit\n");

  const agent = await loginAs("agent1");
  const client = await loginAs("client1");

  // Step 1: Get current profile
  const profile = await api("GET", `/users/${agent.user.id}`, agent.accessToken);
  assertEqual(profile.status, 200, "Agent can GET own profile");
  const origName = profile.data?.fullName;
  const origLang = profile.data?.preferredLanguage;
  console.log(`  Original: fullName="${origName}", preferredLanguage="${origLang}"`);

  // Step 2: Edit profile
  const edit = await api("PUT", `/users/${agent.user.id}`, agent.accessToken, {
    fullName: "QA Test Name",
    preferredLanguage: "hy",
  });
  assertEqual(edit.status, 200, "Edit own profile returns 200");
  assertEqual(edit.data?.fullName, "QA Test Name", "fullName updated");
  assertEqual(edit.data?.preferredLanguage, "hy", "preferredLanguage updated to hy");

  // Step 3: Verify persisted
  const refetch = await api("GET", `/users/${agent.user.id}`, agent.accessToken);
  assertEqual(refetch.data?.fullName, "QA Test Name", "fullName persisted on GET");
  assertEqual(refetch.data?.preferredLanguage, "hy", "preferredLanguage persisted on GET");

  // Step 4: Cannot change own role
  const roleChange = await api("PUT", `/users/${agent.user.id}`, agent.accessToken, {
    role: "admin",
  });
  // Should either fail (403) or silently ignore the field
  const afterRole = await api("GET", `/users/${agent.user.id}`, agent.accessToken);
  assert(
    roleChange.status === 403 || afterRole.data?.role === "agent",
    "Role change rejected or ignored (still agent)",
    { status: roleChange.status, role: afterRole.data?.role }
  );

  // Step 5: Cannot change own isActive
  const activeChange = await api("PUT", `/users/${agent.user.id}`, agent.accessToken, {
    isActive: false,
  });
  const afterActive = await api("GET", `/users/${agent.user.id}`, agent.accessToken);
  assert(
    activeChange.status === 403 || afterActive.data?.isActive === true,
    "isActive change rejected or ignored (still active)",
    { status: activeChange.status, isActive: afterActive.data?.isActive }
  );

  // Step 6: Restore
  const restore = await api("PUT", `/users/${agent.user.id}`, agent.accessToken, {
    fullName: origName || "Agent One",
    preferredLanguage: origLang || "en",
  });
  assertEqual(restore.status, 200, "Restore profile returns 200");

  // Step 7: Client can edit own profile
  const clientEdit = await api("PUT", `/users/${client.user.id}`, client.accessToken, {
    fullName: "Client QA Name",
    preferredLanguage: "hy",
  });
  assertEqual(clientEdit.status, 200, "Client can edit own profile");

  // Restore client
  await api("PUT", `/users/${client.user.id}`, client.accessToken, {
    fullName: "Client One",
    preferredLanguage: "en",
  });

  return printSummary("S11-4: User Profile Edit");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
