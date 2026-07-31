import { NextResponse } from "next/server";
import {
  contactSchema,
  deliverContact,
  fieldErrors,
} from "@/lib/contact";
import { CONTACT_ENABLED } from "@/lib/site";

export async function POST(request: Request) {
  // Closed alongside the page, so a hidden form leaves no endpoint accepting
  // personal data that nothing is going to read.
  if (!CONTACT_ENABLED) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form", fields: fieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  // Honeypot: a real person never sees this field. Report success without
  // delivering — telling a bot it was blocked only helps it try again.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  try {
    const channel = await deliverContact(parsed.data, new Date().toISOString());
    return NextResponse.json({ ok: true, channel });
  } catch (error) {
    // Never report success we cannot back. Somebody typed their real phone
    // number in; if it did not reach anyone, they need to know that now.
    const message =
      error instanceof Error ? error.message : "Could not send your enquiry";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
