import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  accessConfigured,
  isValidCode,
  issueToken,
} from "@/lib/access";

/**
 * Exchange the access code for a cookie.
 *
 * Deliberately not under a protected prefix — this is the door, so it has to be
 * reachable from outside.
 */
export async function POST(request: Request) {
  if (!accessConfigured()) {
    return NextResponse.json(
      {
        error:
          "This deployment is locked: ACCESS_CODE is not set on the server, so no code can open it.",
      },
      { status: 503 },
    );
  }

  let code: string | undefined;
  try {
    ({ code } = (await request.json()) as { code?: string });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!code || !(await isValidCode(code.trim()))) {
    // One message for both empty and wrong, so the response says nothing about
    // how close an attempt was.
    return NextResponse.json(
      { error: "That code is not right." },
      { status: 401 },
    );
  }

  const token = await issueToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, token!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  return response;
}

/** Sign out, mostly so a shared laptop can be handed back. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_COOKIE);
  return response;
}
