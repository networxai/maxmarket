import { useLocation } from "react-router-dom";

export function PlaceholderPage() {
  const location = useLocation();
  const segment = location.pathname.split("/").filter(Boolean)[0] ?? "Page";
  const title = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");

  return (
    <div className="rounded-lg border bg-muted/30 p-8 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">Coming soon.</p>
    </div>
  );
}
