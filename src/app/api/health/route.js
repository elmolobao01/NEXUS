import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function healthPayload() {
  return {
    status: "ok",
    service: "PLENIUM",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    timestamp: new Date().toISOString(),
  };
}

export async function GET() {
  return NextResponse.json(healthPayload(), {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
