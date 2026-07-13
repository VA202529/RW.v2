import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StarRating } from "@/components/StarRating";
import { getBookingSummary, submitReview, dutchError } from "@/lib/api/client";
import { dutchDate } from "@/lib/format";

export const Route = createFileRoute("/review/$bookingId")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (!search.token) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Review achterlaten — RW CUTZZ" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { bookingId } = Route.useParams();
  const { token } = Route.useSearch();
  const { data } = useQuery({
    queryKey: ["booking-summary", bookingId],
    queryFn: () => getBookingSummary({ booking_id: bookingId }),
  });
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="min-h-screen bg-brand-bg">
      <SiteHeader />
      <section className="pt-28 pb-20 px-6 max-w-2xl mx-auto">
        <h1 className="font-display text-4xl font-extrabold tracking-tighter mb-4">
          Laat een review achter
        </h1>
        {data && (
          <p className="text-brand-muted mb-8">
            {data.service_name} · {dutchDate(data.starts_at)}
          </p>
        )}
        {done ? (
          <div className="bg-brand-surface border border-brand-text/10 rounded p-8 text-center">
            <p className="text-2xl">🙏</p>
            <p className="mt-2">Bedankt voor je review! Hij wordt zichtbaar na goedkeuring.</p>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (rating < 1) return toast.error("Kies een aantal sterren.");
              if (body.trim().length < 10) return toast.error("Minimaal 10 tekens.");
              setSubmitting(true);
              try {
                await submitReview({ booking_id: bookingId, token: token!, rating, body });
                setDone(true);
              } catch (e) {
                toast.error(dutchError(e));
              } finally {
                setSubmitting(false);
              }
            }}
            className="grid gap-6 bg-brand-surface p-6 border border-brand-text/10 rounded"
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-muted mb-2">Sterren</p>
              <StarRating value={rating} onChange={setRating} size={32} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-muted mb-2">
                Jouw ervaring
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 1000))}
                placeholder="Vertel over je ervaring..."
                rows={5}
                className="w-full bg-brand-bg border border-brand-text/15 rounded p-3 text-sm focus:outline-none focus:border-brand-accent"
              />
              <p className="text-[11px] text-brand-muted mt-1 text-right">{body.length}/1000</p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-brand-accent text-white px-6 py-3 text-xs font-bold uppercase tracking-widest hover:glow-accent transition disabled:opacity-50"
            >
              Review plaatsen
            </button>
          </form>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
