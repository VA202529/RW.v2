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
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/boekingen", label: "Boekingen", icon: ClipboardList },
  { to: "/klanten", label: "Klanten", icon: Users },
  { to: "/diensten", label: "Diensten", icon: Scissors },
  { to: "/webshop", label: "Webshop", icon: ShoppingBag },
  { to: "/aankondigingen", label: "Aankondigingen", icon: Megaphone },
  { to: "/reviews", label: "Reviews", icon: Star },
  { to: "/beschikbaarheid", label: "Beschikbaarheid", icon: Clock },
  { to: "/statistieken", label: "Statistieken", icon: BarChart3 },
];
