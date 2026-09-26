import { noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { processMolliePaymentById } from "../_shared/mollie-finalize.ts";

const PAYMENT_ID_PATTERN = /^tr_[A-Za-z0-9]{5,64}$/;

Deno.serve(async (req) => {
  try {
    const paymentId = await readPaymentId(req);
    if (!PAYMENT_ID_PATTERN.test(paymentId)) return noStoreJson({ received: true, ignored: true });
    console.log("[mollie-webhook] processing payment:", paymentId);

    const result = await processMolliePaymentById(serviceClient(), paymentId);

    return noStoreJson({ received: true, action: result.action });
  } catch (error) {
    console.error("mollie-webhook failed", error);
    return noStoreJson({ received: false, processed: false }, 500);
  }
});

async function readPaymentId(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    return typeof body?.id === "string" ? body.id : "";
  }
  const form = new URLSearchParams(await req.text());
  return form.get("id") ?? "";
}
