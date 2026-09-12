import { NextResponse } from "next/server";
import { getSystem } from "@/lib/integrations/docker";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getSystem();
  const data = result.data;

  return NextResponse.json(
    {
      health: data.versionReachable ? "healthy" : "offline",
      version: data.version,
      images: data.images,
      memoryTotalBytes: data.memoryTotalBytes,
      diskUsedBytes: data.diskUsedBytes,
      diskReclaimableBytes: data.diskReclaimableBytes,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
