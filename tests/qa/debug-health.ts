const API = "http://localhost:3000";
async function main() {
  const paths = ["/health", "/api/health", "/api/v1/health", "/healthz", "/api/v1/healthz", "/ping", "/api/v1/ping", "/status", "/api/v1/status"];
  for (const p of paths) {
    const res = await fetch(`${API}${p}`);
    console.log(`${p}: ${res.status}`);
    if (res.status === 200) {
      const data = await res.json().catch(() => null);
      console.log(`  → ${JSON.stringify(data)}`);
    }
  }
}
main();
