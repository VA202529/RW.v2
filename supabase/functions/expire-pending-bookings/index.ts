import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const supabase = serviceClient();
    const { data: superseded, error } = await supabase.rpc("wp1_supersede_expired_pending");
    if (error) throw error;

    const { data: queued, error: queueError } = await supabase
      .from("checkout_session_expirations")
      .select("id,stripe_checkout_session_id")
      .eq("status", "queued")
      .limit(25);
    if (queueError) throw queueError;

    const stripe = stripeClient();
    const account = connectedAccount();
    for (const item of queued ?? []) {
      try {
        await stripe.checkout.sessions.expire(item.stripe_checkout_session_id, {}, { stripeAccount: account });
        await supabase
          .from("checkout_session_expirations")
          .update({ status: "processed", processed_at: new Date().toISOString() })
          .eq("id", item.id);
      } catch (error) {
        await supabase
          .from("checkout_session_expirations")
          .update({ status: "failed", attempts: 1, last_error: String(error) })
          .eq("id", item.id);
      }
    }

    return json({ superseded, expired_sessions: queued?.length ?? 0 });
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
