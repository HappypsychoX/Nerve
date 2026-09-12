import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import {
  buildWudUpdatesResponse,
  getWudUpdates,
} from "@/lib/integrations/wud";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const config = loadConfig();
  const wudService = config.services.find((s) => s.id === "wud");
  const wudUrl = wudService?.url ?? process.env.WUD_URL ?? null;
  const result = await getWudUpdates();
  const body = buildWudUpdatesResponse(result, wudUrl);
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
