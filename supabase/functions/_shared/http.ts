const allowedOrigins = [
  "https://rw-v2-website.vercel.app",
  "https://rwcutzz.com",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://192.168.68.134:8080",
];

export function corsHeaders(req?: Request) {
  const origin = req?.headers.get("origin") ?? "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature, x-hub-signature-256",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
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
