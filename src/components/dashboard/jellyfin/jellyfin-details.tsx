"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildCodecDetailRows,
  formatDetailValue,
  formatTranscodeReasons,
  jellyfinMethodLabel,
} from "@/lib/jellyfin-display";
import type { JellyfinPlayback } from "@/lib/integrations/jellyfin/types";

export function JellyfinDetails({ playback }: { playback: JellyfinPlayback }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const rows = buildCodecDetailRows(playback);
  const reasons = formatTranscodeReasons(playback.transcodeReasons);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="inline-flex items-center gap-1 text-2xs font-medium text-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
        Technical details
      </button>

      <div id={panelId} hidden={!expanded} className="mt-2 rounded bg-surface-2 px-3 py-2 text-2xs">
        <dl className="flex items-baseline justify-between gap-3">
          <dt className="text-faint">Playback method</dt>
          <dd className="text-fg">{jellyfinMethodLabel(playback.method)}</dd>
        </dl>

        <table className="mt-2 w-full">
          <caption className="sr-only">
            Source and transcoded output codecs and resolution
          </caption>
          <thead>
            <tr className="text-left text-faint">
              <th scope="col" className="pb-1 pr-2 font-normal"></th>
              <th scope="col" className="pb-1 pr-2 font-normal">Source</th>
              <th scope="col" className="pb-1 font-normal">Output (transcode)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="align-top">
                <th scope="row" className="py-0.5 pr-2 text-left font-normal text-faint">
                  {row.label}
                </th>
                <td className="py-0.5 pr-2 break-words text-fg">{formatDetailValue(row.source)}</td>
                <td className="py-0.5 break-words text-fg">{formatDetailValue(row.output)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {reasons !== null ? (
          <dl className="mt-2 flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-faint">Transcode reasons</dt>
            <dd className="text-right break-words text-fg">{reasons}</dd>
          </dl>
        ) : null}
      </div>
    </div>
  );
}
