import { loadConfig } from "@/lib/config";
import { ContainersView } from "@/components/containers/containers-view";

export default function ContainersPage() {
  const config = loadConfig();
  return <ContainersView groups={config.groups} />;
}
