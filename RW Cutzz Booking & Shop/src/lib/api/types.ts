export type Service = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  duration_minutes: number;
  buffer_minutes: number;
  deposit_amount: number | null;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  stock: number;
  image_paths: string[];
  category: string;
};

export type Review = {
  rating: number;
  body: string;
  first_name: string;
  last_initial: string;
  service_name: string;
  created_at: string;
};

export type Guest = {
  full_name: string;
  email: string;
  phone_e164?: string;
  whatsapp_opt_in: boolean;
  marketing_email_opt_in: boolean;
  terms_accepted: true;
};

export type UpcomingBooking = {
  id: string;
  service_name: string;
  starts_at: string;
  deposit_cents: number;
  remaining_cents: number;
  status: string;
};

export type PastBooking = {
  id: string;
  service_name: string;
  starts_at: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show" | "superseded";
  has_review: boolean;
};

export type OrderSummary = {
  id: string;
  created_at: string;
  items_summary: string;
  total_cents: number;
  status: "paid" | "ready_for_pickup" | "picked_up" | "cancelled";
  cancellable: boolean;
};

export type AccountData = {
  customer: { full_name: string; email: string; phone_e164?: string; visit_count: number };
  upcoming_bookings: UpcomingBooking[];
  past_bookings: PastBooking[];
  credit_cents: number;
  orders: OrderSummary[];
  reviews: Array<{
    rating: number;
    body: string;
    is_visible: boolean;
    service_name: string;
    starts_at: string;
  }>;
  notification_prefs: { whatsapp_opt_in: boolean; marketing_email_opt_in: boolean };
};

export type ManageBookingSummary = {
  status: number;
  booking_id: string;
  service_id: string;
  service_name: string;
  starts_at: string;
  ends_at: string;
  booking_status: "pending_payment" | "confirmed" | "completed" | "cancelled" | "no_show" | "superseded" | "refunded_conflict";
  duration_minutes: number;
  deposit_cents: number;
  remaining_cents: number;
  paid_deposit_cents: number;
  payment_provider?: "stripe" | "mollie" | "credit" | null;
  payment_status?: "pending" | "paid" | "refunded" | "partially_refunded" | "failed" | null;
  before_cancellation_deadline: boolean;
  can_cancel: boolean;
  can_reschedule: boolean;
  already_cancelled: boolean;
};

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.code = opts?.code;
    this.status = opts?.status;
  }
}
