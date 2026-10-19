import { Analyzer } from "@/components/analyzer";
import { PROJECT_NAME } from "@/lib/site";
import { gateActive } from "@/lib/access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Demo — ${PROJECT_NAME}`,
  description: "Run a call recording through the pipeline and inspect each stage's output.",
};

export default function DemoPage() {
  return <Analyzer gated={gateActive()} />;
}
