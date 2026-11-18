import type { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessMaxAge } from "@/lib/access";

/** The one way the access cookie is written: by the code form and by the magic link. */
export function setAccessCookie(response: NextResponse, token: string) {
  response.cookies.set(ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: accessMaxAge(),
  });
}
