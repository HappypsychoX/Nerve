import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/config";
import {
  fetchJellyfinPrimaryImage,
  isValidJellyfinImageTag,
  isValidJellyfinItemId,
} from "@/lib/integrations/jellyfin/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_SNIFF: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  // Route params are asynchronous in Next.js 15.5.
  const { itemId } = await params;
  const tag = new URL(request.url).searchParams.get("tag");

  // Validate before any upstream request; invalid input returns 404 without
  // ever touching Jellyfin.
  if (!isValidJellyfinItemId(itemId) || !isValidJellyfinImageTag(tag)) {
    return new NextResponse(null, { status: 404, headers: NO_SNIFF });
  }

  // Mirror the disabled/unconfigured short-circuit used by the sessions and
  // health routes: a disabled section makes zero upstream requests. An
  // unconfigured base URL is already handled inside fetchJellyfinPrimaryImage.
  if (!loadConfig().jellyfin?.enabled) {
    return new NextResponse(null, { status: 404, headers: NO_SNIFF });
  }

  const result = await fetchJellyfinPrimaryImage(itemId, tag);
  if (!result.ok) {
    // Sanitized failure: no upstream URL, body, headers, or key leak out.
    return new NextResponse(null, { status: 404, headers: NO_SNIFF });
  }

  return new NextResponse(result.data, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
