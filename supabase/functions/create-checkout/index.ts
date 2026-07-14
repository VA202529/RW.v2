import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { APPLICATION_FEE_CENTS, connectedAccount, stripeClient } from "../_shared/stripe.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, cents, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { booking_id, cancellation_token } = await req.json();
    const origin = req.headers.get("origin") ?? Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173";
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("wp1_prepare_checkout", { p_booking_id: booking_id });
    if (error) throw error;
    if (data.status !== 200) return json(data, data.status);
    if (!data.requires_stripe) {
      const details = await bookingDetails(supabase, data.booking_id);
      if (details?.whatsapp_opt_in && details.phone_e164) {
        const parts = dateParts(data.starts_at);
        await sendWhatsAppTemplate({
          to_phone: details.phone_e164,
          template_name: "booking_confirmation",
          customer_id: data.customer_id,
          booking_id: data.booking_id,
          components: bodyComponent([firstName(details.customer_name), data.service_name, parts.date, parts.time, cents(data.deposit_cents)]),
        });
      }
      await sendTransactionalEmail({
        template: "booking_confirmation",
        to: data.customer_email,
        customer_id: data.customer_id,
        booking_id: data.booking_id,
        data: { ...data, cancel_token: cancellation_token },
      });
      return json({ confirmed: true, booking_id: data.booking_id });
    }

    const stripe = stripeClient();
    const account = connectedAccount();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["ideal"],
        locale: "nl",
        customer_email: data.customer_email,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${origin}/boeken/succes?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/boeken/verlopen`,
        metadata: { booking_id: data.booking_id, cancel_token: cancellation_token ?? "" },
        payment_intent_data: {
          application_fee_amount: APPLICATION_FEE_CENTS,
          metadata: { booking_id: data.booking_id },
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: data.amount_due_cents,
              product_data: { name: `Aanbetaling ${data.service_name}` },
            },
          },
        ],
      },
      { stripeAccount: account }
    );

    const { error: attachError } = await supabase.rpc("wp1_attach_checkout_session", {
      p_payment_id: data.payment_id,
      p_session_id: session.id,
      p_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
    });
    if (attachError) throw attachError;

    return json({ url: session.url, booking_id: data.booking_id, amount_due_cents: data.amount_due_cents });
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data } = await supabase.from("bookings").select("id,customers(full_name,phone_e164,notification_prefs(whatsapp_opt_in))").eq("id", bookingId).single();
  if (!data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  return {
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
  };
}
