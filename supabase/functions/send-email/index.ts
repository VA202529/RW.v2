import { handleOptions, json } from "../_shared/http.ts";
import { requireInternal } from "../_shared/auth.ts";
import { sendTransactionalEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  if (!requireInternal(req)) return json({ code: "FORBIDDEN" }, 403);

  try {
    const body = await req.json();
    const result = await sendTransactionalEmail(body);
    return json(result, 200);
  } catch (error) {
    console.error(error);
    return json({ ok: false, code: "SERVER_ERROR" }, 200);
  }
});
