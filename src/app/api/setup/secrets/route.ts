import { NextResponse } from "next/server";
import {
  type SetupVaultKey,
  setupVaultSections,
  updateSetupVault,
} from "@/lib/setup-vault";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sectionId?: string;
      values?: Partial<Record<SetupVaultKey, string>>;
    };

    const section = setupVaultSections.find((candidate) => candidate.id === body.sectionId);

    if (!section) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unknown setup section.",
        },
        { status: 400 },
      );
    }

    const allowedKeys = new Set(section.fields.map((field) => field.key));
    const rawValues = body.values ?? {};
    const acceptedEntries = Object.entries(rawValues).filter(
      ([key, value]) => allowedKeys.has(key as SetupVaultKey) && typeof value === "string" && value.trim(),
    ) as Array<[SetupVaultKey, string]>;

    if (!acceptedEntries.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "Add at least one value before saving.",
        },
        { status: 400 },
      );
    }

    updateSetupVault(Object.fromEntries(acceptedEntries));

    return NextResponse.json({
      ok: true,
      savedKeys: acceptedEntries.map(([key]) => key),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Setup values could not be saved.",
      },
      { status: 500 },
    );
  }
}
