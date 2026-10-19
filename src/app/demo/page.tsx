import { cookies } from "next/headers";
import { Analyzer } from "@/components/analyzer";
import { PROJECT_NAME } from "@/lib/site";
import {
  ACCESS_COOKIE,
  accessConfigured,
  gateActive,
  isValidToken,
  publicMode,
  uploadLimitFor,
} from "@/lib/access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Demo — ${PROJECT_NAME}`,
  description: "Run a call recording through the pipeline and inspect each stage's output.",
};

export default async function DemoPage() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const unlocked = await isValidToken(token);

  return (
    <Analyzer
      maxBytes={await uploadLimitFor(token)}
      // The lock button is only useful when there is a cookie to clear.
      gated={gateActive() || (publicMode() && unlocked)}
      canUnlock={publicMode() && accessConfigured() && !unlocked}
    />
  );
}
