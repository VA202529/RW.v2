import Stripe from "npm:stripe@17.7.0";

// Checked against Stripe docs during WP1 implementation:
// - Direct charges use the connected account via Stripe-Account scoping.
// - Checkout Sessions support payment_intent_data.application_fee_amount.
// - Checkout expires_at must be 30 minutes to 24 hours after creation.
// - Direct-charge refunds must be created on the connected account and explicitly
//   pass refund_application_fee=true when the platform fee should be refunded.
export const APPLICATION_FEE_CENTS = 100;

export function stripeClient() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function connectedAccount() {
  const account = Deno.env.get("STRIPE_CONNECTED_ACCOUNT_ID");
  if (!account) throw new Error("Missing STRIPE_CONNECTED_ACCOUNT_ID");
  return account;
}
