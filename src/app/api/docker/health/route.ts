import { NextResponse } from "next/server";
import { getDockerHealth } from "@/lib/integrations/docker";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getDockerHealth();
  if (!result.ok) {
    console.warn("[docker] health check failed:", result.error);
    return NextResponse.json(
      { health: "offline", version: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    { health: "healthy", version: result.data.version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
