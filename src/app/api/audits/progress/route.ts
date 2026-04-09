import { NextResponse } from "next/server";
import { getAuditProgressSnapshot } from "@/lib/sales-machine/outreach-workflows";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

export async function GET() {
  try {
    const audit = await getAuditProgressSnapshot();

    return NextResponse.json({
      audit,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: serializeError(error),
      },
      { status: 500 },
    );
  }
}
