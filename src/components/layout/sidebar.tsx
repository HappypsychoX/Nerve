"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NerveConfig } from "@/lib/config";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({
  config,
  mobileOpen,
  onClose,
}: {
  config: NerveConfig;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-surface-2 transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line-strong bg-surface-3">
            <Activity className="h-5 w-5 text-accent" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-fg">
              {config.title}
            </div>
            <div className="truncate text-2xs text-faint">
              {config.serverName}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-surface-3 text-fg"
                    : "text-muted hover:bg-surface-3/60 hover:text-fg",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-accent" : "text-faint group-hover:text-muted",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line px-4 py-3">
          <div className="flex items-center gap-2 text-2xs text-faint">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-unknown" />
            Skeleton · Milestone 0
          </div>
        </div>
      </aside>
    </>
  );
}
