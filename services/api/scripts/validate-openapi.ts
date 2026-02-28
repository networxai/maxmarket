import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

async function main() {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const openapiPath = path.resolve(root, "..", "..", "contracts", "openapi.yaml");
  const content = await fs.readFile(openapiPath, "utf8");
  const doc = yaml.load(content);
  if (!doc || typeof doc !== "object") {
    throw new Error("OpenAPI document is not an object");
  }
  // Basic sanity checks
  const asAny = doc as any;
  if (!asAny.openapi || !asAny.paths) {
    throw new Error("OpenAPI document must have 'openapi' and 'paths' keys");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("OpenAPI validation failed", err);
  process.exit(1);
});

