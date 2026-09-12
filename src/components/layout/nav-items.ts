import {
  Archive,
  LayoutDashboard,
  RefreshCw,
  Boxes,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/containers", label: "Containers", icon: Boxes },
  { href: "/backups", label: "Backups", icon: Archive },
  { href: "/updates", label: "Updates", icon: RefreshCw },
];
