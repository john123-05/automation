import { NextResponse } from "next/server";
import { z } from "zod";
import {
  uiLanguageCookieName,
  uiThemeCookieName,
} from "@/lib/ui-settings-shared";
import {
  getUiSettingsCookieOptions,
} from "@/lib/ui-settings";

const schema = z.object({
  language: z.enum(["en", "de"]),
  theme: z.enum(["light", "dark"]),
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const response = NextResponse.json({ ok: true });

    response.cookies.set(uiLanguageCookieName, payload.language, getUiSettingsCookieOptions());
    response.cookies.set(uiThemeCookieName, payload.theme, getUiSettingsCookieOptions());

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Settings could not be saved.",
      },
      { status: 400 },
    );
  }
}
