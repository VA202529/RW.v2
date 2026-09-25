import { Resend } from "npm:resend@4.1.2";
import { renderToStaticMarkup } from "npm:react-dom@18.3.1/server";
import { requireAdmin } from "../_shared/auth.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { announcement } from "../_shared/emails/announcement.tsx";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const userId = await requireAdmin(req);
  if (!userId) return json({ code: "FORBIDDEN" }, 403, {}, req);
  try {
    const { title, body } = await req.json();
    const supabase = serviceClient();
    const { data: prepared, error } = await supabase.rpc("wp3_broadcast_recipients", {
      p_auth_user_id: userId,
      p_title: title,
      p_body: body,
    });
    if (error) {
      console.error("broadcast recipients failed", error);
      return json({ code: "BROADCAST_RECIPIENTS_FAILED", message: error.message }, 500, {}, req);
    }
    const recipients = prepared.recipients ?? [];
    const from = Deno.env.get("RESEND_FROM_EMAIL");
    const key = Deno.env.get("RESEND_API_KEY");
    if (!from || !key) return json({ code: "MISSING_EMAIL_CONFIG" }, 500, {}, req);
    const rendered = announcement({ title, body });
    const html = `<!doctype html>${renderToStaticMarkup(rendered.html as any)}`;
    const resend = new Resend(key);
    const { data, error: sendError } = recipients.length
      ? await resend.batch.send(recipients.map((r: any) => ({ from, to: [r.email], subject: rendered.subject, html, text: rendered.text })))
      : { data: [], error: null };
    if (sendError) console.error("broadcast send failed", sendError);
    const results = recipients.map((r: any, index: number) => ({
      customer_id: r.customer_id,
      provider_message_id: data?.[index]?.id ?? null,
      status: sendError ? "failed" : "sent",
    }));
    const { error: logError } = await supabase.rpc("wp3_log_broadcast", { p_auth_user_id: userId, p_template: "announcement", p_results: results });
    if (logError) {
      console.error("broadcast log failed", logError);
      return json({ code: "BROADCAST_LOG_FAILED", message: logError.message }, 500, {}, req);
    }
    return json({ sent: sendError ? 0 : recipients.length, failed: sendError ? recipients.length : 0 }, 200, {}, req);
  } catch (error) {
    console.error(error);
    return json({ code: "SERVER_ERROR", message: error instanceof Error ? error.message : String(error) }, 500, {}, req);
  }
});
