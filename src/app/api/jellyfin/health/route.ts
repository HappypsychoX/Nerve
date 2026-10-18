import { NextResponse } from "next/server";
import { getJellyfinHealth } from "@/lib/integrations/jellyfin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const body = await getJellyfinHealth();
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
