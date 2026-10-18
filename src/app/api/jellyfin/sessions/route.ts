import { NextResponse } from "next/server";
import { getJellyfinSessions } from "@/lib/integrations/jellyfin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const body = await getJellyfinSessions();
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
