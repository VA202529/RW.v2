import { Resend } from "npm:resend@4.1.2";
import { render } from "npm:@react-email/render@1.0.5";
import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { announcement } from "../_shared/emails/announcement.tsx";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403);
  try {
    const { title, body } = await req.json();
    const supabase = serviceClient();
    const { data: prepared, error } = await supabase.rpc("wp3_broadcast_recipients", {
      p_auth_user_id: userId,
      p_title: title,
      p_body: body,
    });
    if (error) throw error;
    const recipients = prepared.recipients ?? [];
    const from = Deno.env.get("RESEND_FROM_EMAIL");
    const key = Deno.env.get("RESEND_API_KEY");
    if (!from || !key) return json({ code: "MISSING_EMAIL_CONFIG" }, 500);
    const rendered = announcement({ title, body });
    const html = await render(rendered.html);
    const resend = new Resend(key);
    const { data, error: sendError } = recipients.length
      ? await resend.batch.send(recipients.map((r: any) => ({ from, to: [r.email], subject: rendered.subject, html, text: rendered.text })))
      : { data: [], error: null };
    const results = recipients.map((r: any, index: number) => ({
      customer_id: r.customer_id,
      provider_message_id: data?.[index]?.id ?? null,
      status: sendError ? "failed" : "sent",
    }));
    await supabase.rpc("wp3_log_broadcast", { p_auth_user_id: userId, p_template: "announcement", p_results: results });
    return json({ sent: sendError ? 0 : recipients.length, failed: sendError ? recipients.length : 0 });
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR" }, 500);
  }
});
