import { Link } from "react-router-dom";
import { useTranslation } from "@/i18n/useTranslation";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <h1 className="text-3xl font-bold">MaxMarket</h1>
      <p className="text-muted-foreground text-center">
        B2B wholesale platform. Browse the catalog or sign in.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link to="/catalog">{t("catalog.browse")}</Link>
        </Button>
      </div>
    </div>
  );
}
