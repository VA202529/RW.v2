const allowedOrigins = [
  "https://rwcutzz.com",
  "https://www.rwcutzz.com",
  "https://rw-v2-website-va202529s-projects.vercel.app",
  "https://rw-v2-website.vercel.app",
  "https://admin.rwcutzz.com",
  "https://barberflow-admin.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
];

export function corsHeaders(req?: Request) {
  const origin = req?.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-hub-signature-256",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  if (allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export const defaultCorsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigins[0],
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function noStoreJson(body: unknown, status = 200, req?: Request) {
  return json(body, status, { "cache-control": "no-store" }, req);
}

export function handleOptions(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  return null;
}
