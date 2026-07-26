import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { AppHeader } from "@/components/app-header";
import { Switch } from "@/components/ui/switch";
import { reviews as initialReviews, type Review } from "@/lib/mock-data";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: "Reviews — BarberFlow" },
      { name: "description", content: "Beheer klantreviews en zichtbaarheid op je pagina." },
      { property: "og:title", content: "Reviews — BarberFlow" },
      { property: "og:description", content: "Alle reviews van RW CUTZZ op één plek." },
    ],
  }),
  component: ReviewsPage,
});

type Filter = "all" | "visible" | "hidden";

function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = reviews.filter((r) =>
    filter === "all" ? true : filter === "visible" ? r.visible : !r.visible,
  );

  return (
    <>
      <AppHeader title="Reviews" large subtitle="Klantbeoordelingen" />
      <PageHeader
        title="Reviews"
        description={`${reviews.length} reviews · gemiddeld ${(
          reviews.reduce((a, r) => a + r.rating, 0) / reviews.length
        ).toFixed(1)}★`}
      />

      <div className="p-4 lg:p-8 space-y-4">
        <div className="flex items-center gap-2">
          {(["all", "visible", "hidden"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs",
                filter === f
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f === "all" ? "Alle" : f === "visible" ? "Zichtbaar" : "Verborgen"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{r.customerName}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.date).toLocaleDateString("nl-NL")}
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3.5 w-3.5",
                        i < r.rating
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/40",
                      )}
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{r.text}</p>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {r.visible ? "Zichtbaar op pagina" : "Verborgen"}
                </span>
                <Switch
                  checked={r.visible}
                  onCheckedChange={(v) =>
                    setReviews(reviews.map((x) => (x.id === r.id ? { ...x, visible: v } : x)))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
