import { NextResponse } from "next/server";
import { refreshGoogleCloudBillingSnapshot } from "@/lib/billing/google-cloud";
import { notifyServerIssue } from "@/lib/system-alerts";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

export async function POST() {
  try {
    const snapshot = await refreshGoogleCloudBillingSnapshot();

    return NextResponse.json({
      ok: true,
      lastUpdatedAt: snapshot.lastUpdatedAt,
      cacheExpiresAt: snapshot.cacheExpiresAt ?? null,
    });
  } catch (error) {
    await notifyServerIssue({
      source: "api/billing/google-cloud/refresh",
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: serializeError(error),
      },
      { status: 500 },
    );
  }
}
