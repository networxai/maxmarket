const API = "http://localhost:3000/api/v1";
async function main() {
  const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin1@maxmarket.com", password: "ChangeMe1!" }) });
  const { accessToken } = await r.json();
  const res = await fetch(`${API}/reports/sales-by-date?dateFrom=2025-01-01&dateTo=2027-01-01`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  const rows = data.data || data;
  console.log("First row keys:", Object.keys(rows[0]));
  console.log("First row:", JSON.stringify(rows[0], null, 2));

  const res2 = await fetch(`${API}/reports/sales-by-manager`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data2 = await res2.json();
  const rows2 = data2.data || data2;
  if (rows2.length > 0) { console.log("\nManager row keys:", Object.keys(rows2[0])); console.log("Manager row:", JSON.stringify(rows2[0], null, 2)); }

  const res3 = await fetch(`${API}/reports/sales-by-client`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data3 = await res3.json();
  const rows3 = data3.data || data3;
  if (rows3.length > 0) { console.log("\nClient row keys:", Object.keys(rows3[0])); console.log("Client row:", JSON.stringify(rows3[0], null, 2)); }

  const res4 = await fetch(`${API}/reports/sales-by-product`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data4 = await res4.json();
  const rows4 = data4.data || data4;
  if (rows4.length > 0) { console.log("\nProduct row keys:", Object.keys(rows4[0])); console.log("Product row:", JSON.stringify(rows4[0], null, 2)); }
}
main().catch(e => console.error(e));
