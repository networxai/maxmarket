// tests/qa/run-full-regression.ts
// Full regression runner — Phases 8–11 (40 suites)
// Run AFTER rate limiter is disabled

import { execSync } from "child_process";

const suites = [
  // Phase 8 (13 suites)
  "s01-order-lifecycle.ts",
  "s02-insufficient-stock.ts",
  "s03-price-override.ts",
  "s04-version-edit.ts",
  "s05-optimistic-lock.ts",
  "s06-agent-scoping.ts",
  "s07-client-readonly.ts",
  "s08-return-stock.ts",
  "s09-cancel-stock.ts",
  "s10-draft-delete.ts",
  "rbac-matrix.ts",
  "edge-cases.ts",
  "regression-phase7.ts",
  // Phase 9 (10 suites)
  "s9-01-user-crud.ts",
  "s9-02-agent-client-assign.ts",
  "s9-03-client-group-crud.ts",
  "s9-04-inventory-adjust.ts",
  "s9-05-product-crud.ts",
  "s9-06-variant-crud.ts",
  "s9-07-category-crud.ts",
  "s9-08-variant-images.ts",
  "s9-09-rbac-admin.ts",
  "s9-10-regression.ts",
  // Phase 10 (10 suites)
  "s10-01-sales-by-date.ts",
  "s10-02-sales-by-manager.ts",
  "s10-03-sales-by-client.ts",
  "s10-04-sales-by-product.ts",
  "s10-05-csv-export.ts",
  "s10-06-audit-logs.ts",
  "s10-07-audit-clear.ts",
  "s10-08-auto-stock.ts",
  "s10-09-rbac-reports-audit.ts",
  "s10-10-regression.ts",
  // Phase 11 (7 suites)
  "s11-01-i18n-fetch.ts",
  "s11-02-i18n-update.ts",
  "s11-03-accept-language.ts",
  "s11-04-profile-edit.ts",
  "s11-05-manager-report.ts",
  "s11-06-rbac-i18n.ts",
  "s11-07-regression.ts",
];

interface SuiteResult {
  suite: string;
  passed: number;
  failed: number;
  failures: string[];
  crashed: boolean;
  crashMsg?: string;
}

const results: SuiteResult[] = [];
const startTime = Date.now();

for (let i = 0; i < suites.length; i++) {
  const suite = suites[i];
  const label = `[${i + 1}/${suites.length}]`;
  process.stdout.write(`${label} ${suite} ... `);

  try {
    const output = execSync(`npx tsx ${suite}`, {
      encoding: "utf-8",
      cwd: process.cwd(),
      timeout: 180_000,
    });

    const passMatch = output.match(/Passed:\s*(\d+)/);
    const failMatch = output.match(/Failed:\s*(\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    const failures = output.split("\n")
      .filter(l => l.includes("❌"))
      .map(l => l.trim().replace(/^❌\s*FAIL:\s*/, ""));

    results.push({ suite, passed, failed, failures, crashed: false });

    if (failed > 0) {
      console.log(`❌ ${passed}✅ ${failed}❌`);
      failures.forEach(f => console.log(`      → ${f}`));
    } else {
      console.log(`✅ ${passed} passed`);
    }
  } catch (e: any) {
    const output = (e.stdout || "") + (e.stderr || "");
    const passMatch = output.match(/Passed:\s*(\d+)/);
    const failMatch = output.match(/Failed:\s*(\d+)/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;
    const failures = output.split("\n")
      .filter((l: string) => l.includes("❌"))
      .map((l: string) => l.trim().replace(/^❌\s*FAIL:\s*/, ""));

    if (passed > 0 || failed > 0) {
      results.push({ suite, passed, failed, failures, crashed: false });
      if (failed > 0) {
        console.log(`❌ ${passed}✅ ${failed}❌`);
        failures.forEach(f => console.log(`      → ${f}`));
      } else {
        console.log(`✅ ${passed} passed`);
      }
    } else {
      const msg = output.split("\n").find((l: string) => l.includes("Error") || l.includes("Fatal")) || "Unknown crash";
      results.push({ suite, passed: 0, failed: 0, failures: [], crashed: true, crashMsg: msg.slice(0, 120) });
      console.log(`💥 CRASH`);
      console.log(`      → ${msg.slice(0, 120)}`);
    }
  }
}

const elapsed = Math.round((Date.now() - startTime) / 1000);

// ═══════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════

const totalPassed = results.reduce((s, r) => s + r.passed, 0);
const totalFailed = results.reduce((s, r) => s + r.failed, 0);
const crashedSuites = results.filter(r => r.crashed);
const failedSuites = results.filter(r => r.failed > 0);
const greenSuites = results.filter(r => !r.crashed && r.failed === 0);

console.log(`\n${"═".repeat(70)}`);
console.log(`  FULL REGRESSION SUMMARY — Phases 8–11`);
console.log(`${"═".repeat(70)}`);
console.log(`  Suites:     ${suites.length} total  |  ${greenSuites.length} green  |  ${failedSuites.length} with failures  |  ${crashedSuites.length} crashed`);
console.log(`  Assertions: ${totalPassed + totalFailed} total  |  ${totalPassed} passed  |  ${totalFailed} failed`);
console.log(`  Time:       ${elapsed}s`);

if (failedSuites.length > 0) {
  console.log(`\n  ❌ Suites with failures:`);
  failedSuites.forEach(r => {
    console.log(`    ${r.suite}: ${r.passed}✅ ${r.failed}❌`);
    r.failures.forEach(f => console.log(`      → ${f}`));
  });
}

if (crashedSuites.length > 0) {
  console.log(`\n  💥 Crashed suites:`);
  crashedSuites.forEach(r => {
    console.log(`    ${r.suite}: ${r.crashMsg}`);
  });
}

console.log(`\n${"═".repeat(70)}`);
if (totalFailed === 0 && crashedSuites.length === 0) {
  console.log(`  ✅ ALL ${totalPassed} ASSERTIONS PASSED — NO REGRESSIONS`);
} else {
  console.log(`  ⚠️  ${totalFailed} failures + ${crashedSuites.length} crashes — see details above`);
}
console.log(`${"═".repeat(70)}\n`);
