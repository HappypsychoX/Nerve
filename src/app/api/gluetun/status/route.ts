import { NextResponse } from "next/server";
import {
  buildVpnStatusResponse,
  getVpnStatus,
} from "@/lib/integrations/gluetun";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await getVpnStatus();
  const body = buildVpnStatusResponse(result);
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
