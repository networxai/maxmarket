import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MultilingualString } from "@/types/api";

interface MultilingualInputProps {
  label: string;
  value: MultilingualString;
  onChange: (val: MultilingualString) => void;
  required?: boolean;
  placeholder?: { en?: string; hy?: string; ru?: string };
}

export function MultilingualInput({
  label,
  value,
  onChange,
  required = false,
  placeholder = {},
}: MultilingualInputProps) {
  const update = (key: keyof MultilingualString, v: string | null) => {
    const next = { ...value };
    if (v === "" || v == null) {
      if (key === "en") next.en = "";
      else (next as Record<string, unknown>)[key] = null;
    } else {
      (next as Record<string, unknown>)[key] = v;
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <div className="grid gap-2">
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">
            English {required && "(required)"}
          </label>
          <Input
            value={value.en ?? ""}
            onChange={(e) => update("en", e.target.value)}
            placeholder={placeholder.en}
            required={required}
          />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Armenian</label>
          <Input
            value={value.hy ?? ""}
            onChange={(e) => update("hy", e.target.value || null)}
            placeholder={placeholder.hy}
          />
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Russian</label>
          <Input
            value={value.ru ?? ""}
            onChange={(e) => update("ru", e.target.value || null)}
            placeholder={placeholder.ru}
          />
        </div>
      </div>
    </div>
  );
}
