import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "src/app/api/health/route.ts",
  "src/app/api/internal/integration-health/route.ts",
  "docs/backend/phase-13-report.md",
  "docs/backend/phase-13-operations.md",
];
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(root, file))) failures.push(`missing ${file}`);
}

const nextConfig = readFileSync(resolve(root, "next.config.ts"), "utf8");
for (const marker of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options"]) {
  if (!nextConfig.includes(marker)) failures.push(`security header missing: ${marker}`);
}

const envExample = readFileSync(resolve(root, ".env.example"), "utf8");
for (const name of ["APP_ENV", "CRON_SECRET", "DURABLE_SAMPLE_CHECKOUT_ENABLED", "JOB_PROCESSING_BACKEND"]) {
  if (!new RegExp(`^${name}=`, "m").test(envExample)) failures.push(`environment contract missing: ${name}`);
}

if (failures.length) {
  console.error(`Phase 13 check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Phase 13 repository hardening check passed: health probes, security headers, rollout documentation, and environment contract are present.");
