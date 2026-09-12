import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import { checkServices } from "@/lib/integrations/services";
import type { ServicesHealthResponse } from "@/lib/integrations/services/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const config = loadConfig();
  const services = await checkServices(config.services);
  const body: ServicesHealthResponse = { services };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
