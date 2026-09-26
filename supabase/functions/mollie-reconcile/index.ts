import { requireInternal } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { processMolliePaymentById } from "../_shared/mollie-finalize.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (!requireInternal(req)) return json({ code: "FORBIDDEN" }, 403);

  const supabase = serviceClient();
  const results = {
    checked: 0,
    recovered: 0,
    pending: 0,
    failed: 0,
    errors: 0,
  };

  try {
    const { data: candidates, error } = await supabase.rpc("wp_mollie_reconciliation_candidates", {
      p_min_age: "15 minutes",
      p_limit: 25,
    });
    if (error) throw error;

    for (const candidate of candidates ?? []) {
      const paymentId = candidate?.mollie_payment_id;
      if (typeof paymentId !== "string") continue;
      results.checked += 1;
      try {
        const result = await processMolliePaymentById(supabase, paymentId);
        if (result.action === "confirmed" || result.action === "already_confirmed") results.recovered += 1;
        else if (result.action === "pending") results.pending += 1;
        else if (result.action === "failed") results.failed += 1;
      } catch (error) {
        results.errors += 1;
        console.error("[mollie-reconcile] payment failed", { payment_id: paymentId, error: String(error) });
      }
    }

    return json({ status: 200, ...results });
  } catch (error) {
    console.error("[mollie-reconcile] failed", error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
