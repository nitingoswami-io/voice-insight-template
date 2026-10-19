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
 * Off unless `ACCESS_CODE` is set. Doing this in proxy rather than
 * per-route means a new metered endpoint is covered by adding it to
 * PROTECTED_PREFIXES, instead of by remembering to repeat a check — the failure
 * mode of per-route guards is the one you forget.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) return NextResponse.next();
  if (!gateActive()) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");

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
