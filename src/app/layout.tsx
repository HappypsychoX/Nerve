import type { Metadata, Viewport } from "next";
import "./globals.css";
import { loadConfig } from "@/lib/config";
import { AppShell } from "@/components/layout/app-shell";
import { overallHealth } from "@/lib/mock/dashboard";

export const metadata: Metadata = {
  title: "Nerve",
  description: "Private self-hosted homelab operations dashboard",
};

export const viewport: Viewport = {
  themeColor: "#0a0d13",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = loadConfig();

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppShell config={config} health={overallHealth}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
