import {
  Calendar,
  ClipboardList,
  Users,
  Scissors,
  ShoppingBag,
  Megaphone,
  Star,
  Clock,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Agenda", icon: Calendar },
  { to: "/admin/boekingen", label: "Boekingen", icon: ClipboardList },
  { to: "/admin/klanten", label: "Klanten", icon: Users },
  { to: "/admin/diensten", label: "Diensten", icon: Scissors },
  { to: "/admin/webshop", label: "Webshop", icon: ShoppingBag },
  { to: "/admin/aankondigingen", label: "Aankondigingen", icon: Megaphone },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/beschikbaarheid", label: "Beschikbaarheid", icon: Clock },
  { to: "/admin/statistieken", label: "Statistieken", icon: BarChart3 },
];
