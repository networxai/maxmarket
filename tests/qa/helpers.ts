// tests/qa/helpers.ts
// Shared test utilities for MaxMarket QA

const API = "http://localhost:3000/api/v1";
const DEFAULT_PASSWORD = "ChangeMe1!";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LoginResult {
  accessToken: string;
  user: { id: string; role: string; email: string };
}

export interface ApiResponse {
  status: number;
  data: any;
  correlationId: string;
}

// ── State ──────────────────────────────────────────────────────────────────

let passes: string[] = [];
let failures: string[] = [];

// ── Auth ───────────────────────────────────────────────────────────────────

export async function login(email: string, password = DEFAULT_PASSWORD): Promise<LoginResult> {
  for (let attempt = 0; attempt < 7; attempt++) {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.status === 429 || res.status === 500) {
      const wait = (attempt + 1) * 15; // 15s, 30s, 45s, 60s...
      console.log(`  ⏳ ${res.status === 429 ? "Rate limited" : "Server error (rate limit?)"} on login for ${email}, waiting ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Login failed for ${email}: ${res.status} — ${body}`);
    }
    return res.json();
  }
  throw new Error(`Login failed for ${email}: still failing after retries`);
}

// ── API Call ───────────────────────────────────────────────────────────────

export async function api(
  method: string,
  path: string,
  token?: string,
  body?: any
): Promise<ApiResponse> {
  const headers: Record<string, string> = {
    "X-Correlation-ID": crypto.randomUUID(),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const correlationId = res.headers.get("x-correlation-id") || "missing";
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // No JSON body (e.g. 204)
  }

  return { status: res.status, data, correlationId };
}

// ── Assertions ────────────────────────────────────────────────────────────

export function assert(condition: boolean, message: string, context?: any) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`, context ? JSON.stringify(context, null, 2) : "");
    failures.push(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    passes.push(message);
  }
}

export function assertEqual(actual: any, expected: any, message: string) {
  assert(
    actual === expected,
    message,
    { expected, actual }
  );
}

export function assertIncludes(arr: any[], item: any, message: string) {
  assert(
    Array.isArray(arr) && arr.includes(item),
    message,
    { array: arr, lookingFor: item }
  );
}

export function assertAbsentOrNull(obj: any, key: string, message: string) {
  assert(
    obj == null || !(key in obj) || obj[key] == null,
    message,
    { key, value: obj?.[key] }
  );
}

// ── Counters ──────────────────────────────────────────────────────────────

export function resetCounters() {
  passes = [];
  failures = [];
}

export function getResults() {
  return { passes: [...passes], failures: [...failures] };
}

export function printSummary(scenario: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${scenario}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  Passed: ${passes.length}  |  Failed: ${failures.length}`);
  if (failures.length > 0) {
    console.log(`\n  Failures:`);
    failures.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
  }
  console.log(`${"=".repeat(60)}\n`);
  return failures.length === 0;
}

// ── Role Tokens Cache ─────────────────────────────────────────────────────

const tokenCache: Record<string, LoginResult> = {};

export async function loginAs(role: string): Promise<LoginResult> {
  const emails: Record<string, string> = {
    super_admin: "super_admin@maxmarket.com",
    admin: "admin1@maxmarket.com",
    manager: "manager1@maxmarket.com",
    agent1: "agent1@maxmarket.com",
    agent2: "agent2@maxmarket.com",
    client1: "client1@maxmarket.com",
    client2: "client2@maxmarket.com",
    client3: "client3@maxmarket.com",
  };
  const email = emails[role];
  if (!email) throw new Error(`Unknown role shorthand: ${role}`);
  if (!tokenCache[role]) {
    tokenCache[role] = await login(email);
  }
  return tokenCache[role];
}

// ── Constants ─────────────────────────────────────────────────────────────

export const WAREHOUSE_ID = "00000000-0000-0000-0000-000000000010";

// ── Helpers for common flows ──────────────────────────────────────────────

/** Get first available product variant with stock */
export async function getFirstVariant(token: string): Promise<{ variantId: string; pricePerUnit: number; productId: string }> {
  // First get stock entries to know which variants have stock
  const stockRes = await api("GET", "/inventory/stock", token);
  const stockEntries = stockRes.data?.data || stockRes.data || [];
  const variantIdsWithStock = new Set(stockEntries.map((s: any) => s.variantId));

  const res = await api("GET", "/catalog/products", token);
  if (res.status !== 200) throw new Error(`Catalog fetch failed: ${res.status}`);
  const products = res.data?.data || res.data || [];

  // Prefer variants that have stock rows
  for (const product of products) {
    const variants = product.variants || [];
    for (const v of variants) {
      const vid = v.id || v.variantId;
      if (vid && variantIdsWithStock.has(vid)) {
        return {
          variantId: vid,
          pricePerUnit: v.pricePerUnit || v.price || 0,
          productId: product.id,
        };
      }
    }
  }

  // Fallback: return any variant
  for (const product of products) {
    const variants = product.variants || [];
    for (const v of variants) {
      if (v.id || v.variantId) {
        return {
          variantId: v.id || v.variantId,
          pricePerUnit: v.pricePerUnit || v.price || 0,
          productId: product.id,
        };
      }
    }
  }
  throw new Error("No product variant found in catalog");
}

/** Get agent's clients */
export async function getAgentClients(agentId: string, token: string): Promise<any[]> {
  const res = await api("GET", `/users/${agentId}/clients`, token);
  if (res.status !== 200) throw new Error(`Failed to get clients: ${res.status}`);
  return res.data?.data || res.data || [];
}

/** Create a draft order as agent */
export async function createDraft(
  token: string,
  clientId: string,
  variantId: string,
  qty: number
): Promise<ApiResponse> {
  return api("POST", "/orders", token, {
    clientId,
    lineItems: [{ variantId, qty, warehouseId: WAREHOUSE_ID }],
  });
}

/** Create → submit → approve full flow, returns order */
export async function createApprovedOrder(
  agentToken: string,
  managerToken: string,
  clientId: string,
  variantId: string,
  qty: number
): Promise<any> {
  const draft = await createDraft(agentToken, clientId, variantId, qty);
  if (draft.status !== 201) throw new Error(`Draft failed: ${draft.status} ${JSON.stringify(draft.data)}`);
  const orderId = draft.data.id;

  const submit = await api("POST", `/orders/${orderId}/submit`, agentToken);
  if (submit.status !== 200) throw new Error(`Submit failed: ${submit.status} ${JSON.stringify(submit.data)}`);

  const orderAfterSubmit = submit.data;
  const approve = await api("POST", `/orders/${orderId}/approve`, managerToken, {
    versionLock: orderAfterSubmit.versionLock,
  });
  if (approve.status !== 200) throw new Error(`Approve failed: ${approve.status} ${JSON.stringify(approve.data)}`);

  return approve.data;
}

/** Create → submit → approve → fulfill full flow */
export async function createFulfilledOrder(
  agentToken: string,
  managerToken: string,
  clientId: string,
  variantId: string,
  qty: number
): Promise<any> {
  const approved = await createApprovedOrder(agentToken, managerToken, clientId, variantId, qty);
  const orderId = approved.id;
  const fulfill = await api("POST", `/orders/${orderId}/fulfill`, managerToken);
  if (fulfill.status !== 200) throw new Error(`Fulfill failed: ${fulfill.status} ${JSON.stringify(fulfill.data)}`);
  return fulfill.data;
}

/** Get stock for a variant */
export async function getStock(variantId: string, token: string): Promise<{ availableQty: number; reservedQty: number; warehouseId: string }> {
  const res = await api("GET", `/inventory/stock?variantId=${variantId}`, token);
  if (res.status !== 200) throw new Error(`Stock fetch failed: ${res.status}`);
  const stock = res.data?.data?.[0] || res.data?.[0] || res.data;
  return {
    availableQty: stock.availableQty ?? stock.available_qty ?? 0,
    reservedQty: stock.reservedQty ?? stock.reserved_qty ?? 0,
    warehouseId: stock.warehouseId ?? WAREHOUSE_ID,
  };
}
