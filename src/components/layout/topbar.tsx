"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import type { IntegrationHealth } from "@/types";
import { StatusPill } from "@/components/ui/status-dot";
import { Clock } from "./clock";
import { NAV_ITEMS } from "./nav-items";

export function Topbar({
  health,
  onMenuClick,
}: {
  health: IntegrationHealth;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();

  const current = NAV_ITEMS.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-line bg-bg/80 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:text-fg lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <h1 className="truncate text-sm font-semibold tracking-tight text-fg">
          {current?.label ?? "Nerve"}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <Clock />
        <StatusPill health={health} />
      </div>
    </header>
  );
}
