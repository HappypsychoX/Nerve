"use client";

import { useEffect } from "react";
import { Card, CardHeader } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader title="Something went wrong" />
        <div className="space-y-4 px-4 py-4">
          <p className="text-sm text-muted">
            The dashboard encountered an unexpected error.
          </p>
          {error.digest ? (
            <p className="font-mono text-2xs text-faint">{error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-fg hover:bg-surface-3"
          >
            Retry
          </button>
        </div>
      </Card>
    </div>
  );
}
