import { NextResponse } from "next/server";
import { z } from "zod";
import { mutateDb } from "@/lib/sales-machine/store";
import { createId, nowIso } from "@/lib/sales-machine/utils";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().max(120).optional().or(z.literal("")),
  dailyLimit: z.coerce.number().int().min(1).max(5000).optional(),
  smtpHost: z.string().trim().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  smtpUsername: z.string().trim().min(1),
  smtpPassword: z.string().min(1),
  imapHost: z.string().trim().optional().or(z.literal("")),
  imapPort: z.coerce.number().int().min(1).max(65535).optional(),
  imapSecure: z.boolean().optional(),
  imapUsername: z.string().trim().optional().or(z.literal("")),
  imapPassword: z.string().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.parse(await request.json());
    const hasImap = Boolean(parsed.imapHost && parsed.imapUsername && parsed.imapPassword);

    await mutateDb((db) => {
      const existing = db.connectedMailboxes.find(
        (candidate) => candidate.email.toLowerCase() === parsed.email.toLowerCase(),
      );

      const payload = {
        id: existing?.id ?? createId("mailbox"),
        provider: "smtp" as const,
        email: parsed.email.toLowerCase(),
        displayName: parsed.displayName?.trim() || null,
        status: "connected" as const,
        signature: existing?.signature ?? null,
        dailyLimit: parsed.dailyLimit ?? existing?.dailyLimit ?? 100,
        oauthData: {
          smtp: {
            host: parsed.smtpHost,
            port: parsed.smtpPort,
            secure: parsed.smtpSecure,
            username: parsed.smtpUsername,
            password: parsed.smtpPassword,
          },
          ...(hasImap
            ? {
                imap: {
                  host: parsed.imapHost,
                  port: parsed.imapPort ?? 993,
                  secure: parsed.imapSecure ?? true,
                  username: parsed.imapUsername,
                  password: parsed.imapPassword,
                },
              }
            : {}),
        },
        createdAt: existing?.createdAt ?? nowIso(),
        updatedAt: nowIso(),
      };

      if (existing) {
        Object.assign(existing, payload);
      } else {
        db.connectedMailboxes.push(payload);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Manual mailbox connect failed.",
      },
      { status: 400 },
    );
  }
}
