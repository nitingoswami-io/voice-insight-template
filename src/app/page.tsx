import {
  Capabilities,
  ClosingCta,
  Evidence,
  Hero,
  HowItWorks,
} from "@/components/landing/sections";

export default function Home() {
  return (
    <>
      <Hero />
      <Capabilities />
      <HowItWorks />
      <Evidence />
      <ClosingCta />
    </>
  );
}
