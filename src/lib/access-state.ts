import { cookies } from "next/headers";
import { ACCESS_COOKIE, gateActive, readAccess } from "@/lib/access";
import { passDays } from "@/lib/demo-pass";

/** What a demo page needs to render the access notice: the gate, and who holds the pass. */
export async function accessState() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const pass = await readAccess(token);
  return {
    token,
    gated: gateActive(),
    holder: pass ? { email: pass.email, exp: pass.exp } : null,
    passDays: passDays(),
  };
}
