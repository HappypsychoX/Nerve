import { getQuickLinks, loadConfig } from "@/lib/config";
import { Overview } from "@/components/dashboard/overview";

export default function OverviewPage() {
  const config = loadConfig();
  return <Overview quickLinks={getQuickLinks(config)} />;
}
