// tests/qa/s12-03-health.ts
import { assert, assertEqual, resetCounters, printSummary } from "./helpers.ts";

const API = "http://localhost:3000";

async function main() {
  resetCounters();
  console.log("\n🔄 S12-03: Health Check\n");

  const start = Date.now();
  const res = await fetch(`${API}/health`);
  const elapsed = Date.now() - start;
  const data = await res.json();

  // 1. Status 200
  assertEqual(res.status, 200, "GET /health returns 200");

  // 2. Status field
  assert(
    data.status === "ok" || data.status === "healthy" || data.status === "up",
    "Response has status = ok/healthy/up",
    { status: data.status }
  );

  // 3. Timestamp field
  assert(
    data.timestamp !== undefined || data.uptime !== undefined,
    "Response has timestamp or uptime field",
    { keys: Object.keys(data) }
  );
  if (data.timestamp) {
    const d = new Date(data.timestamp);
    assert(!isNaN(d.getTime()), "Timestamp is valid ISO date");
  } else {
    assert(true, "Timestamp check (used uptime instead)");
  }

  // 4. Response time
  console.log(`  Response time: ${elapsed}ms`);
  assert(elapsed < 100, `Response time < 100ms (was ${elapsed}ms)`);

  return printSummary("S12-03: Health Check");
}

main().catch(e => { console.error("Fatal error:", e); process.exit(1); });
