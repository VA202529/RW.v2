import { authUserId } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await authUserId(req);
  if (!userId) return json({ code: "UNAUTHENTICATED" }, 401);
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("wp2_get_account", { p_auth_user_id: userId });
  if (error) return json({ code: "SERVER_ERROR" }, 500);
  if (!data || data.status !== 200) return json(data ?? { code: "CUSTOMER_NOT_FOUND" }, data?.status ?? 404);

  const { data: orders } = await supabase.rpc("wp4_get_account_orders", { p_auth_user_id: userId });
  const { data: reviews } = await supabase.rpc("wp5_get_account_reviews", { p_auth_user_id: userId });
  return json({
    customer: {
      ...(data.customer ?? {}),
      visit_count: data.visit_count ?? data.customer?.visit_count ?? 0,
    },
    upcoming_bookings: data.upcoming_bookings ?? data.upcoming ?? [],
    past_bookings: data.past_bookings ?? data.past ?? [],
    credit_cents: data.credit_cents ?? 0,
    orders: orders ?? [],
    reviews: reviews ?? [],
    notification_prefs: data.notification_prefs ?? data.prefs ?? {
      whatsapp_opt_in: false,
      marketing_email_opt_in: false,
      reminder_3h_enabled: true,
    },
  }, 200);
});
