// tests/qa/debug-versions.ts

const API = "http://localhost:3000/api/v1";
const WH = "00000000-0000-0000-0000-000000000010";

async function main() {
  const agentLogin = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "agent1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const agent = await agentLogin.json();

  const managerLogin = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "manager1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const manager = await managerLogin.json();

  const adminLogin = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const admin = await adminLogin.json();

  // Setup
  const clientsRes = await fetch(`${API}/users/${agent.user.id}/clients`, {
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const clients = await clientsRes.json();
  const clientId = clients.data[0].id;

  const catRes = await fetch(`${API}/catalog/products`, {
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });
  const cat = await catRes.json();
  const variantId = (cat.data || cat)[0].variants[0].id;

  // Create → submit → approve
  const draftRes = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${agent.accessToken}` },
    body: JSON.stringify({ clientId, lineItems: [{ variantId, qty: 5, warehouseId: WH }] }),
  });
  const draft = await draftRes.json();
  console.log("Draft:", draft.id, "version:", draft.currentVersion, "lock:", draft.versionLock);

  await fetch(`${API}/orders/${draft.id}/submit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${agent.accessToken}` },
  });

  const approveRes = await fetch(`${API}/orders/${draft.id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${manager.accessToken}` },
    body: JSON.stringify({ versionLock: draft.versionLock }),
  });
  const approved = await approveRes.json();
  console.log("Approved version:", approved.currentVersion, "lock:", approved.versionLock);

  // Check versions BEFORE edit
  console.log("\n=== Versions BEFORE admin edit ===");
  const v1 = await fetch(`${API}/orders/${draft.id}/versions`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  console.log("Status:", v1.status);
  const v1Data = await v1.json();
  console.log(JSON.stringify(v1Data, null, 2));

  // Admin edit
  const editRes = await fetch(`${API}/orders/${draft.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin.accessToken}` },
    body: JSON.stringify({
      lineItems: [{ variantId, qty: 8, warehouseId: WH }],
      notes: "QA debug version test",
      versionLock: approved.versionLock,
    }),
  });
  const edited = await editRes.json();
  console.log("\nEdited version:", edited.currentVersion, "lock:", edited.versionLock);

  // Check versions AFTER edit
  console.log("\n=== Versions AFTER admin edit ===");
  const v2 = await fetch(`${API}/orders/${draft.id}/versions`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  console.log("Status:", v2.status);
  const v2Data = await v2.json();
  console.log(JSON.stringify(v2Data, null, 2));

  // Check individual version details
  const versions = v2Data.data || v2Data;
  for (let i = 0; i < versions.length; i++) {
    const vNum = versions[i].version || versions[i].versionNumber || (i + 1);
    console.log(`\n=== Version ${vNum} detail ===`);
    const vd = await fetch(`${API}/orders/${draft.id}/versions/${vNum}`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
    });
    console.log("Status:", vd.status);
    const vdData = await vd.json();
    console.log(JSON.stringify(vdData, null, 2).slice(0, 1000));
  }
}

main().catch(e => console.error("Fatal:", e));
