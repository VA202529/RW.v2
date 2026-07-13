import { dutchRelative } from "@/lib/format";

export function RelativeDate({ iso }: { iso: string }) {
  return <span>{dutchRelative(iso)}</span>;
}
