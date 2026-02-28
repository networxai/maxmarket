import { prisma } from "../../lib/prisma.js";

export async function getUiStringsByLanguage(language: string) {
  const rows = await prisma.uiTranslation.findMany({
    where: { language },
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function upsertUiStrings(language: string, strings: Record<string, string>) {
  for (const [key, value] of Object.entries(strings)) {
    await prisma.uiTranslation.upsert({
      where: {
        language_key: { language, key },
      },
      create: { language, key, value },
      update: { value },
    });
  }
  return getUiStringsByLanguage(language);
}
