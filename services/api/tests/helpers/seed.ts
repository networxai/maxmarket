import { runSeed } from "../../prisma/seed.js";

let seeded = false;

export async function ensureSeed(): Promise<void> {
  if (seeded) return;
  await runSeed();
  seeded = true;
}

