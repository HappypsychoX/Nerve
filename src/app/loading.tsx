import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="System" />
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-surface px-4 py-3.5"
            >
              <Skeleton className="h-2 w-2 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="flex h-48 flex-col">
            <CardHeader title="Loading" />
            <div className="flex-1 space-y-4 px-4 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Services" />
        <div className="divide-y divide-line">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Containers" />
        <div className="divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-3 w-14" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
