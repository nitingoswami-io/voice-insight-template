import { handleAccessRequest } from "@/lib/access-request";

/**
 * "Email me a link". Public by design: it sits under /api/access, which the gate
 * never covers, because it is the way in. See docs/DEMO_ACCESS.md.
 */
export async function POST(request: Request) {
  return handleAccessRequest(request);
}
