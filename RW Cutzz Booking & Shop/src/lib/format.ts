import { format, formatDistanceToNow, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import type { Service } from "@/lib/api/types";

export function euros(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function dutchDate(iso: string): string {
  return format(parseISO(iso), "EEEE d MMMM 'om' HH:mm", { locale: nl });
}

export function dutchDateShort(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy", { locale: nl });
}

export function dutchRelative(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { locale: nl, addSuffix: true });
}

export function serviceDepositCents(service: Service): number {
  return typeof service.deposit_amount === "number" ? service.deposit_amount : 0;
}
