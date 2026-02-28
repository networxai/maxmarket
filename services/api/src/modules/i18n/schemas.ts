import { z } from "zod";

const langKey = z.enum(["en", "hy", "ru"]);
export const getUiStringsQuerySchema = z.object({
  language: langKey.default("en"),
});

export const putUiStringsBodySchema = z.object({
  language: langKey,
  strings: z.record(z.string(), z.string()),
});
