import { useEffect } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, login } = useAuth();
  const loginMutation = useLogin();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
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
          navigate("/", { replace: true });
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

  if (isAuthenticated) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>MaxMarket</CardTitle>
          <CardDescription>{t("auth.signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                disabled={loginMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={loginMutation.isPending}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
