import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { useTranslation } from "@/i18n/useTranslation";
import { useUpdateUser } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const LANGUAGES = [
  { value: "en" as const, label: "English" },
  { value: "hy" as const, label: "Հայերեն" },
  { value: "ru" as const, label: "Русский" },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { t, setLanguage } = useTranslation();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(
    user?.preferredLanguage ?? "en"
  );

  const updateMutation = useUpdateUser(user?.id ?? null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPreferredLanguage(user.preferredLanguage ?? "en");
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await updateMutation.mutateAsync({
        fullName: fullName.trim(),
        preferredLanguage: preferredLanguage as "en" | "hy" | "ru",
      });
      if (preferredLanguage !== user.preferredLanguage) {
        setLanguage(preferredLanguage as "en" | "hy" | "ru");
      }
      toast.success(t("settings.profileUpdated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("nav.settings")}</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-medium">{t("settings.profile")}</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                value={user.email}
                readOnly
                disabled
                className="mt-1 bg-muted"
              />
            </div>
            <div>
              <Label>{t("auth.role")}</Label>
              <div className="mt-1">
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-sm">
                  {t(`roles.${user.role}`)}
                </span>
              </div>
            </div>
            {user.role === "client" && user.clientGroupId && (
              <div>
                <Label>{t("auth.clientGroup")}</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user.clientGroupId}
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="fullName">{t("auth.fullName")}</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lang">{t("auth.preferredLanguage")}</Label>
              <select
                id="lang"
                value={preferredLanguage}
                onChange={(e) =>
                  setPreferredLanguage(e.target.value as "en" | "hy" | "ru")
                }
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1"
              >
                {LANGUAGES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={updateMutation.isPending}>
              {t("common.save")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-medium">Password</h2>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            {t("settings.passwordChange")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
