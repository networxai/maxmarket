import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/useTranslation";
import { useUiStrings, useUpdateUiStrings } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hy", label: "Հայերեն" },
  { value: "ru", label: "Русский" },
];

export function I18nAdminPage() {
  const { t } = useTranslation();
  const [activeLang, setActiveLang] = useState("en");
  const [search, setSearch] = useState("");
  const [addKeyOpen, setAddKeyOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [edited, setEdited] = useState<Record<string, string>>({});

  const { data: apiStrings = {}, refetch } = useUiStrings(activeLang);
  const updateMutation = useUpdateUiStrings();

  const mergedStrings = useMemo(() => {
    const out = { ...apiStrings };
    Object.entries(edited).forEach(([k, v]) => {
      out[k] = v;
    });
    return out;
  }, [apiStrings, edited]);

  const filteredKeys = useMemo(() => {
    const keys = Object.keys(mergedStrings).sort();
    if (!search.trim()) return keys;
    const q = search.toLowerCase();
    return keys.filter((k) => k.toLowerCase().includes(q));
  }, [mergedStrings, search]);

  const hasChanges = Object.keys(edited).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    try {
      await updateMutation.mutateAsync({
        language: activeLang,
        strings: edited,
      });
      setEdited({});
      toast.success(t("i18n.translationsSaved"));
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errors.failedToSave"));
    }
  };

  const handleAddKey = () => {
    if (!newKey.trim()) {
      toast.error(t("common.keyRequired"));
      return;
    }
    setEdited((prev) => ({ ...prev, [newKey.trim()]: newValue }));
    setAddKeyOpen(false);
    setNewKey("");
    setNewValue("");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("nav.translations")}</h1>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-md border p-1">
          {LANGUAGES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setActiveLang(value);
                setEdited({});
              }}
              className={`rounded px-3 py-1 text-sm ${activeLang === value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          placeholder={t("i18n.filterKeys")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={() => setAddKeyOpen(true)}>
          {t("i18n.addKey")}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {t("common.saveChanges")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[400px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">{t("common.key")}</th>
              <th className="px-4 py-2 text-left font-medium">{t("common.translation")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredKeys.map((key) => (
              <tr key={key} className="border-b last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{key}</td>
                <td className="px-4 py-2">
                  <Input
                    value={mergedStrings[key] ?? ""}
                    onChange={(e) =>
                      setEdited((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="h-8"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredKeys.length === 0 && (
        <p className="text-center text-muted-foreground">
          {search ? t("common.noKeysMatch") : t("common.noTranslationKeys")}
        </p>
      )}

      <Dialog open={addKeyOpen} onOpenChange={setAddKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("common.key")}</Label>
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g. nav.example"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t("common.translation")}</Label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Translation"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddKeyOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleAddKey}>{t("common.add")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
