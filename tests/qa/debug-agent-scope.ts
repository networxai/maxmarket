// tests/qa/debug-agent-scope.ts

const API = "http://localhost:3000/api/v1";

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "agent1@maxmarket.com", password: "ChangeMe1!" }),
  });
  const { accessToken: token, user } = await loginRes.json();
  console.log("Agent1 ID:", user.id);

  const ordersRes = await fetch(`${API}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ordersData = await ordersRes.json();
  const orders = ordersData.data || ordersData;

  console.log(`\nTotal orders returned: ${orders.length}\n`);
  for (const o of orders) {
    const foreign = o.agentId !== user.id ? " ⚠️ FOREIGN" : "";
    console.log(`  Order ${o.orderNumber || o.id} | agentId: ${o.agentId} | clientId: ${o.clientId} | status: ${o.status}${foreign}`);
  }

  const foreignOrders = orders.filter((o: any) => o.agentId && o.agentId !== user.id);
  console.log(`\nForeign orders: ${foreignOrders.length}`);
  if (foreignOrders.length > 0) {
    console.log("Foreign agentIds:", [...new Set(foreignOrders.map((o: any) => o.agentId))]);
  }

  // Also check: do any orders have agentId = null?
  const nullAgent = orders.filter((o: any) => !o.agentId);
  console.log(`Orders with null/missing agentId: ${nullAgent.length}`);
}

main().catch(e => console.error("Fatal:", e));
