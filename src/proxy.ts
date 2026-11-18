import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  gateActive,
  isProtectedPath,
  isValidToken,
} from "@/lib/access";

/**
 * One optional gate in front of every route that calls a metered API.
 *
 * Off unless `DEMO_ACCESS_SECRET` or `ACCESS_CODE` is set (docs/DEMO_ACCESS.md).
 * Doing this in proxy rather than per-route means a new metered endpoint is
 * covered by adding it to PROTECTED_PREFIXES, instead of by remembering to
 * repeat a check — the failure mode of per-route guards is the one you forget.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname)) return NextResponse.next();
  if (!gateActive()) return NextResponse.next();

  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (await isValidToken(token)) return NextResponse.next();

  // A machine-readable code, so the page opens the access dialog instead of
  // printing an error (docs/DEMO_ACCESS.md, error contract).
  return NextResponse.json(
    {
      error: "This live demo needs an access link. Request one with your email.",
      code: "access_required",
    },
    { status: 401 },
  );
}

export const config = {
  // Matched broadly, then narrowed by isProtectedPath so the protected list
  // lives in one place next to the reasoning for it.
  matcher: ["/api/:path*"],
};
