// tests/qa/s9-01-user-crud.ts
// S9-1: User CRUD Lifecycle

import {
  api, assert, assertEqual, resetCounters, printSummary, loginAs, login,
} from "./helpers.ts";

async function main() {
  resetCounters();
  console.log("\n🔄 S9-1: User CRUD Lifecycle\n");

  const sa = await loginAs("super_admin");
  const uniqueEmail = `qa-agent-${Date.now()}@maxmarket.com`;

  // Step 1-2: Super admin creates a new agent user
  const create = await api("POST", "/users", sa.accessToken, {
    email: uniqueEmail,
    password: "ChangeMe1!",
    fullName: "QA Test Agent",
    role: "agent",
  });
  assertEqual(create.status, 201, "Super admin can create user");
  const userId = create.data?.id;
  assert(!!userId, "Created user has id");
  assertEqual(create.data?.role, "agent", "Created user role is agent");
  assertEqual(create.data?.email, uniqueEmail, "Created user email matches");

  // Step 3: Verify user in list
  const list = await api("GET", "/users", sa.accessToken);
  assertEqual(list.status, 200, "GET /users returns 200");
  const users = list.data?.data || list.data || [];
  const found = users.find((u: any) => u.id === userId);
  assert(!!found, "New user appears in user list");

  // Step 4: Edit user — change fullName
  const edit = await api("PUT", `/users/${userId}`, sa.accessToken, {
    fullName: "QA Agent Updated",
  });
  assertEqual(edit.status, 200, "Edit user returns 200");
  assertEqual(edit.data?.fullName, "QA Agent Updated", "fullName updated");

  // Step 5: Deactivate user
  const deactivate = await api("PUT", `/users/${userId}`, sa.accessToken, {
    isActive: false,
  });
  assertEqual(deactivate.status, 200, "Deactivate returns 200");
  assertEqual(deactivate.data?.isActive, false, "User isActive is false");

  // Step 6: Try to login as deactivated user → should fail
  const loginAttempt = await api("POST", "/auth/login", undefined, {
    email: uniqueEmail,
    password: "ChangeMe1!",
  });
  assertEqual(loginAttempt.status, 401, "Deactivated user cannot login (401)");

  // Step 7: Admin cannot create users
  const admin = await loginAs("admin");
  const adminCreate = await api("POST", "/users", admin.accessToken, {
    email: `qa-admin-test-${Date.now()}@maxmarket.com`,
    password: "ChangeMe1!",
    fullName: "Admin Attempt",
    role: "agent",
  });
  assertEqual(adminCreate.status, 403, "Admin cannot create users (403)");

  // Step 8: Agent cannot list users
  const agent = await loginAs("agent1");
  const agentList = await api("GET", "/users", agent.accessToken);
  assertEqual(agentList.status, 403, "Agent cannot list users (403)");

  return printSummary("S9-1: User CRUD Lifecycle");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
