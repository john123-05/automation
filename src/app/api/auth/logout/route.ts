import { NextResponse } from "next/server";
import { appAccessSessionCookieName } from "@/lib/app-auth-shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/login", url), { status: 303 });

  response.cookies.set(appAccessSessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
