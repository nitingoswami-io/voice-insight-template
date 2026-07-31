import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  accessConfigured,
  gateActive,
  isProtectedPath,
  isValidToken,
} from "@/lib/access";

/**
 * One gate in front of everything that costs money.
 *
 * Doing this in middleware rather than per-route means a new paid endpoint is
 * covered by adding it to PROTECTED_PREFIXES, instead of by remembering to
 * repeat a check — the failure mode of per-route guards is the one you forget.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) return NextResponse.next();
  if (!gateActive()) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

  // Locked because nobody configured a code. Say so plainly rather than
  // showing an unlock form that no code on earth would open.
  if (!accessConfigured()) {
    return isApi
      ? NextResponse.json(
          {
            error:
              "This deployment is locked: ACCESS_CODE is not set. The demo stays closed rather than leaving paid endpoints open.",
          },
          { status: 503 },
        )
      : NextResponse.redirect(new URL("/unlock?reason=unconfigured", request.url));
  }

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (await isValidToken(token)) return NextResponse.next();

  if (isApi) {
    return NextResponse.json(
      { error: "Access code required." },
      { status: 401 },
    );
  }

  const unlock = new URL("/unlock", request.url);
  unlock.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(unlock);
}

export const config = {
  // Matched broadly, then narrowed by isProtectedPath so the protected list
  // lives in one place next to the reasoning for it.
  matcher: ["/demo/:path*", "/api/:path*"],
};
