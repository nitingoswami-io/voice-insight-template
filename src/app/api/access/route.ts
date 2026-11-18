import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  accessConfigured,
  isValidCode,
  issueToken,
} from "@/lib/access";
import { setAccessCookie } from "@/lib/access-cookie";

/**
 * Exchange the shared access code for a pass cookie (sub "access-code").
 *
 * Deliberately not under a protected prefix — this is the door, so it has to be
 * reachable from outside.
 */
export async function POST(request: Request) {
  if (!accessConfigured()) {
    return NextResponse.json(
      {
        error:
          "No ACCESS_CODE is set on this deployment. Request a link by email instead.",
      },
      { status: 409 },
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
  setAccessCookie(response, token!);
  return response;
}

/** Sign out, so a shared machine can be locked again. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ACCESS_COOKIE);
  return response;
}
