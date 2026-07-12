import { json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { connectedAccount, stripeClient } from "../_shared/stripe.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { bodyComponent, cents, dateParts, firstName, sendWhatsAppTemplate } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  const stripe = stripeClient();
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) return json({ code: "MISSING_SIGNATURE_CONFIG" }, 400);

  let event;
  const rawBody = await req.text();
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error(error);
    return json({ code: "BAD_SIGNATURE" }, 400);
  }

  try {
    const supabase = serviceClient();
    const { data: inserted, error: insertError } = await supabase.rpc("wp1_record_stripe_event", {
      p_event_id: event.id,
      p_payload: event as unknown as Record<string, unknown>,
    });
    if (insertError) throw insertError;
    if (!inserted) return json({ received: true, replay: true });

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Record<string, unknown>;
      const bookingId = (session.metadata as Record<string, string> | undefined)?.booking_id;
      const orderId = (session.metadata as Record<string, string> | undefined)?.order_id;
      if (orderId) {
        const cancelToken = (session.metadata as Record<string, string> | undefined)?.cancel_token;
        const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
        const { data: result, error } = await supabase.rpc("wp4_process_order_completed", {
          p_order_id: orderId,
          p_session_id: session.id,
          p_payment_intent_id: paymentIntent,
        });
        if (error) throw error;
        if (result.action === "refund_required" && paymentIntent) {
          await stripe.refunds.create(
            { payment_intent: paymentIntent, refund_application_fee: true },
            { stripeAccount: connectedAccount() }
          );
          await supabase.from("payments").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("order_id", orderId);
        } else if (result.action === "paid" || result.action === "already_paid") {
          const details = await orderDetails(supabase, orderId);
          if (details) {
            if (details.whatsapp_opt_in && details.phone_e164) {
              await sendWhatsAppTemplate({
                to_phone: details.phone_e164,
                template_name: "order_confirmation",
                customer_id: details.customer_id,
                order_id: orderId,
                components: bodyComponent([firstName(details.customer_name), orderItemSummary(details.items), cents(details.total_cents)]),
              });
            }
            await sendTransactionalEmail({
              template: "order_confirmation",
              to: details.customer_email,
              customer_id: details.customer_id,
              order_id: orderId,
              data: { ...details, cancel_token: cancelToken },
            });
            if (!details.auth_user_id) {
              const { data: shouldSendMagicLink } = await supabase.rpc("wp3_should_send_magic_link", { p_customer_id: details.customer_id });
              if (shouldSendMagicLink) {
                const { data: link } = await supabase.auth.admin.generateLink({
                  type: "magiclink",
                  email: details.customer_email,
                  options: { redirectTo: `${Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173"}/account` },
                });
                if (link?.properties?.action_link) {
                  await sendTransactionalEmail({
                    template: "magic_link",
                    to: details.customer_email,
                    customer_id: details.customer_id,
                    order_id: orderId,
                    data: { magic_link: link.properties.action_link },
                  });
                }
              }
            }
          }
        }
      }
      if (bookingId) {
        const cancelToken = (session.metadata as Record<string, string> | undefined)?.cancel_token;
        const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : null;
        const { data: result, error } = await supabase.rpc("wp1_process_checkout_completed", {
          p_booking_id: bookingId,
          p_session_id: session.id,
          p_payment_intent_id: paymentIntent,
        });
        if (error) throw error;

        if (result.action === "refund_required" && paymentIntent) {
          await stripe.refunds.create(
            { payment_intent: paymentIntent, refund_application_fee: true },
            { stripeAccount: connectedAccount() }
          );
          const { error: refundError } = await supabase.rpc("wp1_mark_refunded_conflict", {
            p_booking_id: bookingId,
          });
          if (refundError) throw refundError;
          const details = await bookingDetails(supabase, bookingId);
          if (details) {
            await sendTransactionalEmail({
              template: "conflict_refund",
              to: details.customer_email,
              customer_id: details.customer_id,
              booking_id: bookingId,
              data: details,
            });
          }
        } else if (result.action === "confirmed" || result.action === "already_confirmed") {
          const details = await bookingDetails(supabase, bookingId);
          if (details) {
            if (details.whatsapp_opt_in && details.phone_e164) {
              const parts = dateParts(details.starts_at);
              await sendWhatsAppTemplate({
                to_phone: details.phone_e164,
                template_name: "booking_confirmation",
                customer_id: details.customer_id,
                booking_id: bookingId,
                components: bodyComponent([firstName(details.customer_name), details.service_name, parts.date, parts.time, cents(details.deposit_cents)]),
              });
            }
            await sendTransactionalEmail({
              template: "booking_confirmation",
              to: details.customer_email,
              customer_id: details.customer_id,
              booking_id: bookingId,
              data: { ...details, cancel_token: cancelToken },
            });
            if (!details.auth_user_id) {
              const { data: shouldSendMagicLink } = await supabase.rpc("wp3_should_send_magic_link", {
                p_customer_id: details.customer_id,
              });
              if (shouldSendMagicLink) {
                const { data: link } = await supabase.auth.admin.generateLink({
                  type: "magiclink",
                  email: details.customer_email,
                  options: { redirectTo: `${Deno.env.get("PUBLIC_SITE_URL") ?? "http://localhost:5173"}/account` },
                });
                if (link?.properties?.action_link) {
                  await sendTransactionalEmail({
                    template: "magic_link",
                    to: details.customer_email,
                    customer_id: details.customer_id,
                    booking_id: bookingId,
                    data: { magic_link: link.properties.action_link },
                  });
                }
              }
            }
          }
        }
      }
    }

    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const object = event.data.object as Record<string, unknown>;
      const bookingId = (object.metadata as Record<string, string> | undefined)?.booking_id;
      const orderId = (object.metadata as Record<string, string> | undefined)?.order_id;
      if (orderId) {
        const { error } = await supabase.rpc("wp4_process_order_failed", { p_order_id: orderId });
        if (error) throw error;
      }
      if (bookingId) {
        const { error } = await supabase.rpc("wp1_process_checkout_failed", { p_booking_id: bookingId });
        if (error) throw error;
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error(error);
    return json({ code: "PROCESSING_ERROR" }, 500);
  }
});

async function bookingDetails(supabase: ReturnType<typeof serviceClient>, bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at,deposit_cents,customers(id,email,auth_user_id,full_name,phone_e164,notification_prefs(whatsapp_opt_in)),services(name,price_cents)")
    .eq("id", bookingId)
    .single();
  if (error || !data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const service = Array.isArray(data.services) ? data.services[0] : data.services;
  return {
    booking_id: data.id,
    customer_id: customer.id,
    customer_email: customer.email,
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
    auth_user_id: customer.auth_user_id,
    service_name: service.name,
    starts_at: data.starts_at,
    ends_at: data.ends_at,
    deposit_cents: data.deposit_cents,
    remaining_cents: Math.max((service.price_cents ?? 0) - data.deposit_cents, 0),
  };
}

async function orderDetails(supabase: ReturnType<typeof serviceClient>, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id,total_cents,customers(id,email,auth_user_id,full_name,phone_e164,notification_prefs(whatsapp_opt_in))")
    .eq("id", orderId)
    .single();
  if (error || !data) return null;
  const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
  const { data: items } = await supabase
    .from("order_items")
    .select("quantity,unit_price_cents,products(name)")
    .eq("order_id", orderId);
  return {
    order_id: data.id,
    total_cents: data.total_cents,
    customer_id: customer.id,
    customer_email: customer.email,
    customer_name: customer.full_name,
    phone_e164: customer.phone_e164,
    whatsapp_opt_in: Boolean(Array.isArray(customer.notification_prefs) ? customer.notification_prefs[0]?.whatsapp_opt_in : customer.notification_prefs?.whatsapp_opt_in),
    auth_user_id: customer.auth_user_id,
    items: (items ?? []).map((item: any) => ({
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      name: Array.isArray(item.products) ? item.products[0]?.name : item.products?.name,
    })),
  };
}

function orderItemSummary(items: Array<{ name: string; quantity: number }>) {
  return items.map((item) => `${item.name} x${item.quantity}`).join(", ");
}
