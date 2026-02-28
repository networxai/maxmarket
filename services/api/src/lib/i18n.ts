/**
 * Resolve multilingual field (name/description) per DN-LANG-01: fallback to en.
 */
export type Multilingual = Record<string, string | null | undefined>;

export function resolveLang(obj: Multilingual | null | undefined, lang: string): string {
  if (!obj || typeof obj !== "object") return "";
  const v = obj[lang] ?? obj.en;
  return typeof v === "string" ? v : "";
}
