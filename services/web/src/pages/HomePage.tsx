import { Link } from "react-router-dom";
import { useTranslation } from "@/i18n/useTranslation";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("pages.home.title")}</h2>
        <p className="text-muted-foreground">{t("pages.home.description")}</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <Button asChild>
          <Link to="/catalog">{t("catalog.browse")}</Link>
        </Button>
      </div>
    </div>
  );
}
