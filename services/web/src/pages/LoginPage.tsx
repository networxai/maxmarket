import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/i18n/useTranslation";
import { useLogin } from "@/api/hooks";
import { ApiError } from "@/api/client";
import { getErrorMessage } from "@/lib/error-messages";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, login } = useAuth();
  const loginMutation = useLogin();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/catalog", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    if (!email || !password) return;
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          login(data.accessToken, data.user);
          navigate("/catalog", { replace: true });
        },
        onError: (error) => {
          const msg =
            error instanceof ApiError
              ? error.errorCode === "UNAUTHORIZED"
                ? t("auth.invalidCredentials")
                : error.message
              : getErrorMessage(error, t);
          toast.error(msg);
        },
      }
    );
  };

  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) return null;

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-7/12 items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="relative z-10 text-center px-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Welcome to MaxMarket!</h2>
          <p className="text-muted-foreground text-lg">B2B Wholesale Order Management Platform</p>
        </div>
      </div>
      <div className="w-full lg:w-5/12 flex items-center justify-center p-8 bg-card">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="font-bold text-2xl">MaxMarket</span>
          </div>
          <h1 className="text-2xl font-bold mb-1">{t("auth.signInTitle")}</h1>
          <p className="text-muted-foreground mb-8">{t("auth.signInDescription")}</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder={t("auth.emailPlaceholder")}
                disabled={loginMutation.isPending}
                className="rounded-lg h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={loginMutation.isPending}
                  className="rounded-lg h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 rounded-lg shadow-md shadow-primary/30 text-base"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
