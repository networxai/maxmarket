import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthInjectors } from "@/api/client";
import { languageRef } from "@/lib/language-ref";
import type { User } from "@/types/api";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  role: User["role"] | null;
}

interface AuthContextValue extends AuthState {
  login: (accessToken: string, user: User) => void;
  logout: () => void;
  setAuth: (accessToken: string | null, user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken;

  const setAuth = useCallback((token: string | null, u: User | null) => {
    setAccessToken(token);
    setUser(u);
  }, []);

  const sessionExpired = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  setAuthInjectors(
    () => accessTokenRef.current,
    () => languageRef.current,
    sessionExpired
  );

  const value: AuthContextValue = {
    user,
    accessToken,
    isAuthenticated: !!accessToken && !!user,
    role: user?.role ?? null,
    login: (token, u) => {
      setAccessToken(token);
      setUser(u);
    },
    logout: () => {
      setAccessToken(null);
      setUser(null);
    },
    setAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
