"use client";

import { useMemo, useState } from "react";
import type { ServiceGroupConfig } from "@/lib/config";
import { useDockerContainers } from "@/hooks/use-docker";
import { useUpdates } from "@/hooks/use-updates";
import { ContainerTable } from "./container-table";

export function ContainersView({ groups }: { groups: ServiceGroupConfig[] }) {
  const { health, containers, loading } = useDockerContainers();
  const updates = useUpdates();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return containers.filter((row) => {
      if (
        q &&
        !row.name.toLowerCase().includes(q) &&
        !row.image.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (group !== "all" && row.group !== group) return false;
      if (status === "running" && row.state !== "running") return false;
      if (status === "stopped" && row.state !== "stopped") return false;
      if (status === "restarting" && row.state !== "restarting") return false;
      if (status === "unhealthy" && row.health !== "unhealthy") return false;
      return true;
    });
  }, [containers, query, group, status]);

  return (
    <ContainerTable
      rows={filtered}
      groups={groups}
      health={health}
      loading={loading}
      updates={updates.updates}
      query={query}
      group={group}
      status={status}
      onQueryChange={setQuery}
      onGroupChange={setGroup}
      onStatusChange={setStatus}
    />
  );
}
