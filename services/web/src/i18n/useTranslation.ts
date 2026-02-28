import { useI18nContext } from "./I18nProvider";
import { fallbackStrings } from "./fallback-strings";

export function useTranslation() {
  const { strings, language, setLanguage, isLoading } = useI18nContext();

  function t(key: string, params?: Record<string, string | number>): string {
    let value = strings[key] ?? fallbackStrings[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      });
    }
    return value;
  }

  return { t, language, setLanguage, isLoading };
}

