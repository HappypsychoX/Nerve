import { Play, Pause, Wifi, Zap } from "lucide-react";
import { Metric } from "@/components/ui/metric";
import type { JellyfinCounts } from "@/lib/integrations/jellyfin/types";

export function JellyfinSummary({ counts }: { counts: JellyfinCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4">
      <Metric
        label="Playing"
        value={
          <span className="inline-flex items-center gap-1.5">
            <Play className="h-3 w-3 text-healthy" aria-hidden />
            {counts.playing}
          </span>
        }
      />
      <Metric
        label="Paused"
        value={
          <span className="inline-flex items-center gap-1.5">
            <Pause className="h-3 w-3 text-degraded" aria-hidden />
            {counts.paused}
          </span>
        }
      />
      <Metric
        label="Idle"
        value={
          <span className="inline-flex items-center gap-1.5">
            <Wifi className="h-3 w-3 text-faint" aria-hidden />
            {counts.idle}
          </span>
        }
      />
      <Metric
        label="Transcoding"
        value={
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-accent" aria-hidden />
            {counts.transcoding}
          </span>
        }
      />
    </div>
  );
}
