import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { API_BASE_URL, API_PREFIX } from "@/lib/constants";
import { languageRef } from "@/lib/language-ref";
import { fallbackStrings } from "./fallback-strings";
import type { Language } from "@/types/api";

const STORAGE_LANGUAGE_KEY = "maxmarket_language";

function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_LANGUAGE_KEY);
    if (stored === "en" || stored === "hy" || stored === "ru") return stored;
  } catch {
    // ignore
  }
  return "en";
}

function getBrowserLanguage(): Language {
  try {
    const nav = navigator.language?.slice(0, 2);
    if (nav === "hy" || nav === "ru") return nav;
  } catch {
    // ignore
  }
  return "en";
}

async function fetchUiStrings(lang: string): Promise<Record<string, string>> {
  const res = await fetch(
    `${API_BASE_URL}${API_PREFIX}/i18n/ui-strings?language=${lang}`,
    { credentials: "include" }
  );
  if (!res.ok) return {};
  const data = await res.json();
  return typeof data === "object" ? data : {};
}

interface I18nContextValue {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
  isLoading: boolean;
  strings: Record<string, string>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const { user, accessToken } = useAuth();
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = getStoredLanguage();
    if (stored !== "en") return stored;
    return getBrowserLanguage();
  });
  const [strings, setStrings] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadStrings = useCallback(async (lang: Language) => {
    setIsLoading(true);
    try {
      const fetched = await fetchUiStrings(lang);
      setStrings(fetched);
    } catch {
      setStrings({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    void loadStrings(language);
  }, [language, loadStrings]);

  useEffect(() => {
    if (user?.preferredLanguage && user.preferredLanguage !== language) {
      setLanguageState(user.preferredLanguage);
    }
  }, [user?.preferredLanguage]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      languageRef.current = lang;
      try {
        localStorage.setItem(STORAGE_LANGUAGE_KEY, lang);
      } catch {
        // ignore
      }
      void loadStrings(lang);
      if (user && accessToken) {
        fetch(
          `${API_BASE_URL}${API_PREFIX}/users/${user.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              "Accept-Language": lang,
            },
            credentials: "include",
            body: JSON.stringify({ preferredLanguage: lang }),
          }
        ).catch(() => {});
      }
    },
    [user, accessToken, loadStrings]
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = strings[key] ?? fallbackStrings[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return value;
    },
    [strings]
  );

  const value: I18nContextValue = {
    t,
    language,
    setLanguage,
    isLoading,
    strings,
  };

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18nContext() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18nContext must be used within I18nProvider");
  return ctx;
}
