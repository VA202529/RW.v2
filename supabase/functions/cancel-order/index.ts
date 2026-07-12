import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const body = await req.json();
    const userId = await authUserId(req);
    const supabase = serviceClient();
    const { data: prepared, error } = await supabase.rpc("wp4_prepare_cancel_order", {
      p_order_id: body.order_id,
      p_auth_user_id: userId,
      p_cancel_token: body.cancellation_token ?? null,
    });
    if (error) throw error;
    if (prepared.status !== 200) return json(prepared, prepared.status);
    let refunded = false;
    if (prepared.requires_refund) {
      await stripeClient().refunds.create(
        { payment_intent: prepared.payment_intent_id, refund_application_fee: true },
        { stripeAccount: connectedAccount() },
      );
      refunded = true;
    }
    const { data: finalized, error: finalError } = await supabase.rpc("wp4_finalize_cancel_order", { p_order_id: body.order_id, p_refunded: refunded });
    if (finalError) throw finalError;
    await sendTransactionalEmail({ template: "order_cancelled", to: finalized.customer_email, customer_id: finalized.customer_id, order_id: body.order_id, data: finalized });
    return json(finalized);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
