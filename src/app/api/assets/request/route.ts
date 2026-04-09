import { NextResponse } from "next/server";
import { z } from "zod";
import { requestClientAsset } from "@/lib/sales-machine/agency-os";
import { serializeError } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  clientId: z.string().trim().min(1),
  type: z.string().trim().min(2),
  description: z.string().trim().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const requestEntry = await requestClientAsset({
      clientId: payload.clientId,
      type: payload.type,
      description: payload.description ?? null,
    });

    return NextResponse.json({ ok: true, request: requestEntry });
  } catch (error) {
    return NextResponse.json({ ok: false, error: serializeError(error) }, { status: 500 });
  }
}
