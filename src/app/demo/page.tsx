import { Analyzer } from "@/components/analyzer";
import { DemoAccessProvider } from "@/components/demo-access";
import { PROJECT_NAME } from "@/lib/site";
import { accessConfigured, emailAccessConfigured, publicMode, uploadLimitFor } from "@/lib/access";
import { accessState } from "@/lib/access-state";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Demo — ${PROJECT_NAME}`,
  description: "Run a call recording through the pipeline and inspect each stage's output.",
};

export default async function DemoPage() {
  const { token, gated, holder, passDays } = await accessState();
  const unlocked = holder !== null;

  return (
    <DemoAccessProvider
      providers="AssemblyAI and xAI"
      gated={gated}
      holder={holder}
      passDays={passDays}
    >
      <Analyzer
        maxBytes={await uploadLimitFor(token)}
        // When the gate is on, the access notice carries the sign-out button.
        gated={publicMode() && unlocked}
        canUnlock={publicMode() && (accessConfigured() || emailAccessConfigured()) && !unlocked}
      />
    </DemoAccessProvider>
  );
}
