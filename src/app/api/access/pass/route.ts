import { NextResponse } from "next/server";
import { safeNext } from "@/lib/access";
import { setAccessCookie } from "@/lib/access-cookie";
import { verifyPass } from "@/lib/demo-pass";

/**
 * The magic link lands here (via /unlock?pass=…): check the pass, store it as
 * the httpOnly access cookie, and continue to the demo. A page can't set
 * cookies, so /unlock redirects to this route handler.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pass = url.searchParams.get("pass");
  const next = safeNext(url.searchParams.get("next"));

  if (!(await verifyPass(pass))) {
    const back = new URL("/unlock", url);
    back.searchParams.set("next", next);
    back.searchParams.set("expired", "1");
    return NextResponse.redirect(back, 303);
  }

  const response = NextResponse.redirect(new URL(next, url), 303);
  setAccessCookie(response, pass!);
  return response;
}
