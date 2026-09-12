"use client";

import { useState, type ReactNode } from "react";
import type { NerveConfig } from "@/lib/config";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({
  config,
  children,
}: {
  config: NerveConfig;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <Sidebar
        config={config}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="lg:pl-60">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
