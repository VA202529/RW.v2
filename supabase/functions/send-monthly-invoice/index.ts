import { requireAdmin } from "../_shared/auth.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";
import { handleOptions, noStoreJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

function monthRange(date = new Date()) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  };
}

function sumPaidPayments(payments: Array<{ status?: string; amount_cents?: number; platform_fee_cents?: number }>) {
  const paid = payments.filter((payment) => payment.status === "paid");
  const depositsCents = paid.reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);
  const feeExVatCents = paid.reduce((sum, payment) => sum + (payment.platform_fee_cents ?? 0), 0);
  const vatCents = Math.round(feeExVatCents * 0.21);

  return {
    bookingCount: paid.length,
    depositsCents,
    feeExVatCents,
    vatCents,
    totalInclVatCents: feeExVatCents + vatCents,
  };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const userId = await requireAdmin(req);
  if (!userId) return noStoreJson({ code: "FORBIDDEN" }, 403, req);

  try {
    const now = new Date();
    const { start, end } = monthRange(now);
    const supabase = serviceClient();
    const { data, error } = await supabase.rpc("wp_mollie_admin_payments", {
      p_auth_user_id: userId,
      p_from: start.toISOString(),
      p_to: end.toISOString(),
    });

    if (error) throw error;

    const payments = Array.isArray(data?.payments) ? data.payments : [];
    const summary = sumPaidPayments(payments);
    const monthFormatter = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" });
    const monthLabel = monthFormatter.format(start);
    const payload = {
      month_label: monthLabel,
      period_label: monthLabel,
      booking_count: summary.bookingCount,
      deposits_cents: summary.depositsCents,
      fee_ex_vat_cents: summary.feeExVatCents,
      vat_cents: summary.vatCents,
      total_incl_vat_cents: summary.totalInclVatCents,
    };

    const recipients = ["Chanoroch@outlook.com", "info@geheeldigitaal.nl"];
    const results = await Promise.all(recipients.map((to) => sendTransactionalEmail({
      template: "monthly_invoice",
      to,
      data: payload,
    })));

    const failed = results.filter((result) => !result.ok).length;
    if (failed > 0) {
      return noStoreJson({ code: "EMAIL_SEND_FAILED", success: false, failed, period_label: monthLabel }, 500, req);
    }

    return noStoreJson({ success: true, failed: 0, period_label: monthLabel }, 200, req);
  } catch (error) {
    console.error("send-monthly-invoice failed", error);
    return noStoreJson({ code: "SERVER_ERROR", success: false }, 500, req);
  }
});
